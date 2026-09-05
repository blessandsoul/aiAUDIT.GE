<?php
// Run only inside the authorized Coolify container. No credentials in output.
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$target = App\Models\Application::where('uuid', 'zl19gylndbdsjcw2xhjeqbur')->firstOrFail();
if ($target->git_repository !== 'blessandsoul/aiAUDIT.GE') throw new Exception('Wrong application');
if ($input['action'] === 'configure') {
    foreach (['APIFY_TOKEN', 'AUDIT_SOURCE_STORE', 'AUDIT_SOCIAL_DAILY_USD'] as $key) {
        if (!isset($input[$key])) throw new Exception('Missing configuration');
        $target->environment_variables()->updateOrCreate(['key'=>$key, 'is_preview'=>false],
          ['value'=>$input[$key], 'is_runtime'=>true, 'is_buildtime'=>false, 'is_literal'=>true, 'is_multiline'=>false]);
    }
    $target->persistentStorages()->updateOrCreate(['mount_path'=>'/app/audit-data'],
      ['name'=>'aiaudit-evidence', 'host_path'=>'/data/coolify/aiaudit-evidence']);
    echo json_encode(['configured'=>true,'keys'=>['APIFY_TOKEN','AUDIT_SOURCE_STORE','AUDIT_SOCIAL_DAILY_USD'],'persistent_store'=>true]);
} elseif ($input['action'] === 'deploy') {
    if (!preg_match('/^[a-f0-9]{40}$/', $input['commit'])) throw new Exception('Exact commit required');
    $uuid = (string) Illuminate\Support\Str::uuid();
    $result = queue_application_deployment(application:$target, deployment_uuid:$uuid, commit:$input['commit'], force_rebuild:false);
    echo json_encode(['deployment_uuid'=>$uuid,'result'=>$result]);
} else {
    echo json_encode(['uuid'=>$target->uuid,'name'=>$target->name,'fqdn'=>$target->fqdn,
      'env_keys'=>$target->environment_variables()->pluck('key'),
      'storage'=>$target->persistentStorages()->get(['mount_path','host_path'])]);
}
