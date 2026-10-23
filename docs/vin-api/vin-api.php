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
 * Adapt section 1 (settings: database, two SQL queries, photo location) and nothing else.
 * If your system already has a function that loads a car by VIN, replace load_car() instead.
 */

ini_set('display_errors', '0');   /* never leak PHP warnings into the JSON */
error_reporting(E_ALL);

/* ===================== 1. SETTINGS - adapt these ===================== */
$CFG = array(
    /* Shared secret. The same value is stored on the website side as VIN_API_KEY.
       Any long random string, e.g. 40 characters. Requests without it get 401. */
    'api_key'    => 'CHANGE-ME-to-a-long-random-string',

    /* Database connection (PDO). To reuse the cabinet's own config instead, see load_car(). */
    'db_dsn'     => 'mysql:host=localhost;dbname=DATABASE_NAME;charset=utf8',
    'db_user'    => 'DB_USER',
    'db_pass'    => 'DB_PASSWORD',

    /* Public base URL of photo files; prepended to relative paths coming from the database. */
    'photo_base' => 'https://account.vgae.com.ge/uploads/',

    /* Same for the thumbnails (small copies), if they live somewhere else than the photos. */
    'thumb_base' => 'https://account.vgae.com.ge/uploads/',

    /* The car row. The aliases (AS ...) are what the website understands; keep the names,
       change tables/columns. Every field except id and vin is optional. */
    'sql_car'    => "SELECT c.id         AS id,
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
                      LIMIT 1",

    /* The car's photos: path (relative to photo_base, or a full URL), stage, created_at (optional)
       and thumb (optional): the small copy of the photo, relative to thumb_base or a full URL.
       The website shows thumb in the gallery grid and opens path in full size.
       No thumbnail column? Build it in SQL, e.g. REPLACE(p.path, '/photos/', '/thumbs/') AS thumb,
       or delete the thumb line: the site then shows the full photo in the grid as well. */
    'sql_photos' => "SELECT p.path       AS path,
                            p.thumb      AS thumb,
                            p.stage      AS stage,
                            p.created_at AS created_at
                       FROM car_photos p
                      WHERE p.car_id = :car_id
                      ORDER BY p.id",

    /* How your stage values (p.stage, lower-cased) map to the website's four stages:
       1 = auction, 2 = transport in the USA (warehouse / terminal), 3 = US port (container loading),
       4 = Poti (arrived in Georgia). Unknown values go to stage 1. */
    'stage_map'  => array(
        '1' => 1, '2' => 2, '3' => 3, '4' => 4,
        'auction' => 1, 'auc' => 1,
        'transport' => 2, 'warehouse' => 2, 'terminal' => 2, 'yard' => 2, 'usa' => 2,
        'port' => 3, 'container' => 3, 'loading' => 3, 'ship' => 3, 'sea' => 3,
        'poti' => 4, 'batumi' => 4, 'georgia' => 4, 'arrived' => 4, 'delivered' => 4,
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

/* Loads one car + its photos. Replace the body with a call into your own code if you prefer,
   as long as it returns build_result(...) or null when the VIN is unknown. */
function load_car($pdo, $CFG, $vin)
{
    $st = $pdo->prepare($CFG['sql_car']);
    $st->execute(array(':vin' => $vin));
    $row = $st->fetch();
    if (!$row) {
        return null;
    }
    $photos = array();
    if (isset($row['id']) && $row['id'] !== '') {
        $ps = $pdo->prepare($CFG['sql_photos']);
        $ps->execute(array(':car_id' => $row['id']));
        $photos = $ps->fetchAll();
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

function build_result($CFG, $vin, $row, $photos)
{
    $car = array();
    $fields = array('make', 'model', 'year', 'lot', 'auction', 'status', 'stage', 'location', 'container', 'eta', 'updated_at');
    foreach ($fields as $k) {
        $v = isset($row[$k]) ? trim((string) $row[$k]) : '';
        if ($v === '') {
            continue;
        }
        if ($k === 'year' || $k === 'stage') {
            if ((int) $v > 0) {
                $car[$k] = (int) $v;
            }
        } else {
            $car[$k] = $v;
        }
    }

    /* default names (Georgian); the website shows its own translated names for ids 1-4 */
    $names  = array(1 => 'აუქციონი', 2 => 'ტრანსპორტირება აშშ-ში', 3 => 'პორტი აშშ-ში', 4 => 'ფოთი');
    $stages = array();
    foreach ($names as $id => $name) {
        $stages[$id] = array('id' => $id, 'name' => $name, 'date' => null, 'photos' => array());
    }

    foreach ($photos as $p) {
        $raw = isset($p['stage']) ? strtolower(trim((string) $p['stage'])) : '';
        $id  = isset($CFG['stage_map'][$raw]) ? (int) $CFG['stage_map'][$raw] : 1;
        if (!isset($stages[$id])) {
            $id = 1;
        }
        if (count($stages[$id]['photos']) >= $CFG['max_photos_per_stage']) {
            continue;
        }
        $url = public_url($CFG['photo_base'], isset($p['path']) ? $p['path'] : '');
        if ($url === '') {
            continue;
        }
        $thumb = public_url(isset($CFG['thumb_base']) ? $CFG['thumb_base'] : $CFG['photo_base'], isset($p['thumb']) ? $p['thumb'] : '');
        $stages[$id]['photos'][] = array('url' => $url, 'thumb' => $thumb !== '' ? $thumb : $url);
        if (!$stages[$id]['date'] && !empty($p['created_at'])) {
            $stages[$id]['date'] = substr((string) $p['created_at'], 0, 10);
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
