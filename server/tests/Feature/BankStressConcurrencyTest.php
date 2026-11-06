<?php

namespace Tests\Feature;

use Tests\TestCase;

class BankStressConcurrencyTest extends TestCase
{
    public function test_stress_command_refuses_a_database_without_the_e2e_suffix(): void
    {
        config([
            'database.default' => 'mysql',
            'database.connections.mysql.database' => 'westbridge',
            'database.connections.mysql.url' => null,
        ]);

        $this->artisan('bank:stress-concurrency')
            ->expectsOutputToContain('Refusing E2E work')
            ->assertExitCode(1);
    }

    public function test_mysql_test_command_refuses_the_main_database(): void
    {
        config([
            'database.default' => 'mysql',
            'database.connections.mysql.database' => 'westbridge',
            'database.connections.mysql.url' => null,
        ]);

        $this->artisan('test:mysql')
            ->expectsOutputToContain('Refusing E2E work')
            ->assertExitCode(1);
    }
}