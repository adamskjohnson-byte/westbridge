<?php

namespace App\Console\Commands;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use PDO;
use Throwable;

class E2ePrepare extends E2eCommand
{
    protected $signature = 'dev:e2e-prepare';

    protected $description = 'Create and freshly migrate the isolated local E2E database';

    public function handle(): int
    {
        $connection = $this->e2eDatabaseConfig();
        if ($connection === null) {
            return self::FAILURE;
        }

        if (! extension_loaded('pdo_mysql')) {
            $this->error('The pdo_mysql PHP extension is required for E2E tests.');

            return self::FAILURE;
        }

        try {
            $host = (string) ($connection['host'] ?? '127.0.0.1');
            $port = (string) ($connection['port'] ?? '3306');
            $charset = (string) ($connection['charset'] ?? 'utf8mb4');
            $socket = (string) ($connection['unix_socket'] ?? '');
            $dsn = $socket !== ''
                ? "mysql:unix_socket={$socket};charset={$charset}"
                : "mysql:host={$host};port={$port};charset={$charset}";
            $pdo = new PDO($dsn, (string) ($connection['username'] ?? ''), (string) ($connection['password'] ?? ''), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $database = (string) $connection['database'];
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        } catch (Throwable $exception) {
            $this->error('Could not create or connect to the isolated E2E database: '.$exception->getMessage());

            return self::FAILURE;
        }

        DB::purge($connection['name']);
        $exitCode = Artisan::call('migrate:fresh', [
            '--database' => $connection['name'],
            '--force' => true,
        ]);
        $this->output->write(Artisan::output());

        if ($exitCode !== self::SUCCESS) {
            return self::FAILURE;
        }

        $this->info('E2E database is freshly migrated.');

        return self::SUCCESS;
    }
}
