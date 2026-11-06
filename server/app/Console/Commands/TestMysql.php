<?php

namespace App\Console\Commands;

use Symfony\Component\Process\Process;

class TestMysql extends E2eCommand
{
    protected $signature = 'test:mysql';

    protected $description = 'Run the full PHPUnit suite against the isolated westbridge_e2e MySQL database';

    public function handle(): int
    {
        $database = $this->e2eDatabaseConfig();
        if ($database === null) {
            return self::FAILURE;
        }
        if ($database['database'] !== 'westbridge_e2e') {
            $this->error('Refusing MySQL tests: the database must be exactly westbridge_e2e.');

            return self::FAILURE;
        }
        if (! is_file(base_path('vendor/phpunit/phpunit/phpunit'))) {
            $this->error('PHPUnit is not installed. Run composer install first.');

            return self::FAILURE;
        }

        $process = new Process([
            PHP_BINARY,
            base_path('vendor/phpunit/phpunit/phpunit'),
            '--configuration=phpunit.mysql.xml',
        ], base_path(), [
            'APP_ENV' => 'testing',
            'DB_CONNECTION' => $database['driver'],
            'DB_DATABASE' => 'westbridge_e2e',
            'AUTH_REQUIRE_EMAIL_VERIFICATION' => 'false',
            'TURNSTILE_ENABLED' => 'false',
            'AUTH_ADMIN_2FA_REQUIRED' => 'false',
            'MAIL_MAILER' => 'array',
            'CACHE_STORE' => 'array',
            'QUEUE_CONNECTION' => 'sync',
            'SESSION_DRIVER' => 'array',
        ]);
        $process->setTimeout(null);
        $process->run(fn (string $type, string $buffer) => $this->output->write($buffer));

        return $process->getExitCode() === 0 ? self::SUCCESS : self::FAILURE;
    }
}