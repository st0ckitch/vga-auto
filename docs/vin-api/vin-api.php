<?php
/**
 * VG Auto Export - VIN lookup service for the public website (JSON).
 *
 * - PHP 5.6 or newer, single file, no dependencies (PDO + json).
 * - Upload to the dealer-cabinet server, e.g. https://account.vgae.com.ge/dlr/vin-api.php
 * - Called ONLY by the website's own server component (Cloudflare), never by browsers:
 *       GET /dlr/vin-api.php?vin=JM3KFBCM8M1372923
 *       X-Api-Key: <the shared secret from the settings below>
 * - Answers application/json. Full format: README.md next to this file.
 *
 * Adapt section 1 (settings: database, the car query, the four stage photo queries) and nothing
 * else. If your system already has code that loads a car and its photos, replace load_car().
 */

ini_set('display_errors', '0');   /* never leak PHP warnings into the JSON */
error_reporting(E_ALL);

/* ===================== 1. SETTINGS - adapt these ===================== */
$CFG = array(
    /* Shared secret. The same value is stored on the website side as VIN_API_KEY.
       Any long random string, e.g. 40 characters. Requests without it get 401. */
    'api_key' => 'CHANGE-ME-to-a-long-random-string',

    /* Database connection (PDO). */
    'db_dsn'  => 'mysql:host=localhost;dbname=DATABASE_NAME;charset=utf8',
    'db_user' => 'DB_USER',
    'db_pass' => 'DB_PASSWORD',

    /* The car row. Only id and vin are required. The aliases make, model, year, lot, auction,
       status, stage (1-4), location, container, eta, updated_at are known to the website and get
       translated labels there; all of them are optional - delete the lines you do not have.

       ANY OTHER COLUMN is shown on the page as well, with its alias as the label:
         c.color  AS 'ფერი'               -> a row "ფერი: ..." in the car's details
         c.vessel AS '3:გემი'             -> a row inside stage 3 (prefix 1: 2: 3: 4: = stage)
         c.color  AS 'ფერი|Color|Цвет'    -> label per language (ka|en|ru), optional
       Empty values are skipped. Everything selected here becomes PUBLIC on the website, so do
       not select owner names, phone numbers, prices or other private data. */
    'sql_car' => "SELECT c.id         AS id,
                         c.vin        AS vin,
                         c.make       AS make,
                         c.model      AS model,
                         c.year       AS year,
                         c.lot        AS lot,
                         c.auction    AS auction,
                         c.status     AS status,
                         c.stage      AS stage,
                         c.location   AS location,
                         c.container  AS container,
                         c.eta        AS eta,
                         c.updated_at AS updated_at
                    FROM cars c
                   WHERE c.vin = :vin
                     AND c.active = 1          /* only active cars; remove if you have no such column */
                   LIMIT 1",

    /* Photos: one query per stage of the website (1 auction, 2 transport in the USA, 3 US port,
       4 Poti). Every stage may have its own table and its own folder.
         sql        - must return the column path (file name / path, or a full URL); optionally
                      thumb (the small copy) and created_at (date of the photo). In the WHERE use
                      :car_id (the id from sql_car) or :vin, whichever your table stores.
         base       - public URL of the folder, prepended to relative paths
         thumb_base - same for the small copies (optional, defaults to base). No thumb column?
                      Delete "p.thumb AS thumb," and the site shows the full photo in the grid.
       Same table for all stages? Use the same query with a different WHERE per stage. */
    'stages' => array(
        1 => array(
            'sql'        => "SELECT p.file AS path, p.thumb AS thumb, p.created_at AS created_at
                               FROM photos_auction p WHERE p.car_id = :car_id ORDER BY p.id",
            'base'       => 'https://account.vgae.com.ge/uploads/auction/',
            'thumb_base' => 'https://account.vgae.com.ge/uploads/auction/thumbs/',
        ),
        2 => array(
            'sql'        => "SELECT p.file AS path, p.thumb AS thumb, p.created_at AS created_at
                               FROM photos_warehouse p WHERE p.car_id = :car_id ORDER BY p.id",
            'base'       => 'https://account.vgae.com.ge/uploads/warehouse/',
            'thumb_base' => 'https://account.vgae.com.ge/uploads/warehouse/thumbs/',
        ),
        3 => array(
            'sql'        => "SELECT p.file AS path, p.thumb AS thumb, p.created_at AS created_at
                               FROM photos_port p WHERE p.car_id = :car_id ORDER BY p.id",
            'base'       => 'https://account.vgae.com.ge/uploads/port/',
            'thumb_base' => 'https://account.vgae.com.ge/uploads/port/thumbs/',
        ),
        4 => array(
            'sql'        => "SELECT p.file AS path, p.thumb AS thumb, p.created_at AS created_at
                               FROM photos_poti p WHERE p.car_id = :car_id ORDER BY p.id",
            'base'       => 'https://account.vgae.com.ge/uploads/poti/',
            'thumb_base' => 'https://account.vgae.com.ge/uploads/poti/thumbs/',
        ),
    ),
    'max_photos_per_stage' => 80,
);
/* ===================================================================== */

function respond($status, $data)
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/* constant-time comparison (hash_equals exists since PHP 5.6; fallback kept for safety) */
function same_secret($a, $b)
{
    if (function_exists('hash_equals')) {
        return hash_equals((string) $a, (string) $b);
    }
    if (strlen($a) !== strlen($b)) {
        return false;
    }
    $r = 0;
    for ($i = 0; $i < strlen($a); $i++) {
        $r |= ord($a[$i]) ^ ord($b[$i]);
    }
    return $r === 0;
}

/* runs a query, binding only the placeholders it actually contains (:car_id and/or :vin) */
function fetch_rows($pdo, $sql, $car_id, $vin)
{
    $params = array();
    if (strpos($sql, ':car_id') !== false) {
        $params[':car_id'] = $car_id;
    }
    if (strpos($sql, ':vin') !== false) {
        $params[':vin'] = $vin;
    }
    $st = $pdo->prepare($sql);
    $st->execute($params);
    return $st->fetchAll();
}

/* Loads one car + its photos per stage. Replace the body with calls into your own code if you
   prefer, as long as it returns build_result(...) or null when the VIN is unknown. */
function load_car($pdo, $CFG, $vin)
{
    $rows = fetch_rows($pdo, $CFG['sql_car'], null, $vin);
    if (!$rows) {
        return null;
    }
    $row    = $rows[0];
    $car_id = isset($row['id']) ? $row['id'] : null;
    $photos = array();
    foreach ($CFG['stages'] as $id => $stage) {
        $photos[$id] = empty($stage['sql']) ? array() : fetch_rows($pdo, $stage['sql'], $car_id, $vin);
    }
    return build_result($CFG, $vin, $row, $photos);
}

/* relative path -> public URL (full URLs are kept as they are) */
function public_url($base, $path)
{
    $path = trim((string) $path);
    if ($path === '') {
        return '';
    }
    if (preg_match('#^https?://#i', $path)) {
        return $path;
    }
    return rtrim($base, '/') . '/' . ltrim($path, '/');
}

/* $row: the car row; $photos: array(stage id => rows with path / thumb / created_at) */
function build_result($CFG, $vin, $row, $photos)
{
    $car    = array();
    $info   = array();                                   /* extra columns: label / value rows */
    $known  = array('make', 'model', 'year', 'lot', 'auction', 'status', 'stage', 'location', 'container', 'eta', 'updated_at');
    $names  = array(1 => 'აუქციონი', 2 => 'ტრანსპორტირება აშშ-ში', 3 => 'პორტი აშშ-ში', 4 => 'ფოთი');
    $stages = array();
    foreach ($names as $id => $name) {   /* default names; the website shows its own translations for ids 1-4 */
        $stages[$id] = array('id' => $id, 'name' => $name, 'date' => null, 'info' => array(), 'photos' => array());
    }

    foreach ($row as $col => $val) {
        $col = (string) $col;
        $v   = ($val === null) ? '' : trim((string) $val);
        if ($v === '' || $col === '' || $col === 'id' || $col === 'vin' || ctype_digit($col)) {
            continue;
        }
        if (in_array($col, $known, true)) {
            if ($col === 'year' || $col === 'stage') {
                if ((int) $v > 0) {
                    $car[$col] = (int) $v;
                }
            } else {
                $car[$col] = $v;
            }
        } elseif (preg_match('/^([1-4])\s*:\s*(.+)$/su', $col, $m)) {
            $stages[(int) $m[1]]['info'][] = array('label' => trim($m[2]), 'value' => $v);
        } else {
            $info[] = array('label' => $col, 'value' => $v);
        }
    }

    foreach ($stages as $id => $s) {
        $cfg   = isset($CFG['stages'][$id]) ? $CFG['stages'][$id] : array();
        $base  = isset($cfg['base']) ? $cfg['base'] : '';
        $tbase = !empty($cfg['thumb_base']) ? $cfg['thumb_base'] : $base;
        $rows  = isset($photos[$id]) && is_array($photos[$id]) ? $photos[$id] : array();
        foreach ($rows as $p) {
            if (count($stages[$id]['photos']) >= $CFG['max_photos_per_stage']) {
                break;
            }
            $url = public_url($base, isset($p['path']) ? $p['path'] : '');
            if ($url === '') {
                continue;
            }
            $thumb = public_url($tbase, isset($p['thumb']) ? $p['thumb'] : '');
            $stages[$id]['photos'][] = array('url' => $url, 'thumb' => $thumb !== '' ? $thumb : $url);
            if (!$stages[$id]['date'] && !empty($p['created_at'])) {
                $stages[$id]['date'] = substr((string) $p['created_at'], 0, 10);
            }
        }
    }

    /* no explicit stage in the car row: the last stage that has photos */
    if (!isset($car['stage'])) {
        $last = 0;
        foreach ($stages as $id => $s) {
            if (count($s['photos'])) {
                $last = $id;
            }
        }
        if ($last) {
            $car['stage'] = $last;
        }
    }

    return array(
        'ok'     => true,
        'vin'    => (isset($row['vin']) && $row['vin'] !== '') ? strtoupper((string) $row['vin']) : $vin,
        'car'    => $car,
        'info'   => $info,
        'stages' => array_values($stages),
    );
}

/* ---------------------------- request ---------------------------- */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, array('ok' => false, 'error' => 'method_not_allowed'));
}

$key = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : '';
if ($CFG['api_key'] === '' || strpos($CFG['api_key'], 'CHANGE-ME') === 0 || !same_secret($key, $CFG['api_key'])) {
    respond(401, array('ok' => false, 'error' => 'unauthorized'));
}

$vin = isset($_GET['vin']) ? strtoupper(trim((string) $_GET['vin'])) : '';
if (!preg_match('/^[A-Z0-9]{5,17}$/', $vin)) {
    respond(400, array('ok' => false, 'error' => 'bad_vin'));
}

try {
    $pdo = new PDO($CFG['db_dsn'], $CFG['db_user'], $CFG['db_pass'], array(
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ));
    $result = load_car($pdo, $CFG, $vin);
} catch (Exception $e) {
    respond(500, array('ok' => false, 'error' => 'server_error'));
}

if (!$result) {
    respond(404, array('ok' => false, 'error' => 'not_found', 'vin' => $vin));
}
respond(200, $result);
