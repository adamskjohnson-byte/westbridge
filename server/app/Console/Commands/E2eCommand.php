<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

abstract class E2eCommand extends Command
{
    protected function e2eDatabaseConfig(): ?array
    {
        if (! app()->environment('local', 'testing')) {
            $this->error('E2E database commands are available only in local or testing environments.');

            return null;
        }

        $connectionName = (string) config('database.default');
        $connection = config('database.connections.'.$connectionName);
        $database = is_array($connection) ? ($connection['database'] ?? null) : null;

        if (! in_array($connectionName, ['mysql', 'mariadb'], true)
            || ! is_string($database)
            || ! preg_match('/^[A-Za-z0-9_]+_e2e$/', $database)
            || filled($connection['url'] ?? null)) {
            $this->error('Refusing E2E work: the active database must be a direct MySQL connection whose name ends with _e2e.');

            return null;
        }

        return ['name' => $connectionName, ...$connection];
    }
}
