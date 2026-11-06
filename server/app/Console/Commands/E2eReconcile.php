<?php

namespace App\Console\Commands;

use Illuminate\Support\Facades\Artisan;

class E2eReconcile extends E2eCommand
{
    protected $signature = 'dev:e2e-reconcile';

    protected $description = 'Run bank reconciliation only against the isolated E2E database';

    public function handle(): int
    {
        if ($this->e2eDatabaseConfig() === null) {
            return self::FAILURE;
        }

        $exitCode = Artisan::call('bank:reconcile');
        $this->output->write(Artisan::output());

        return $exitCode === self::SUCCESS ? self::SUCCESS : self::FAILURE;
    }
}
