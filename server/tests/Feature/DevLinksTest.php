<?php

namespace Tests\Feature;

use Tests\TestCase;

class DevLinksTest extends TestCase
{
    public function test_dev_links_refuses_to_run_outside_local_environment(): void
    {
        $this->artisan('dev:links')
            ->expectsOutput('This command is available only when APP_ENV=local.')
            ->assertExitCode(1);
    }
}
