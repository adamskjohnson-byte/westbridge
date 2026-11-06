<?php

namespace App\Console\Commands;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AdminDemote extends Command
{
    protected $signature = 'admin:demote {email}';

    protected $description = 'Demote an administrator to a customer and revoke sessions';

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $user = User::query()->where('email', $email)->where('role', UserRole::Admin)->first();
        if ($user === null) {
            $this->error('Administrator not found.');

            return self::FAILURE;
        }
        if (! $this->confirm('Demote '.$email.' to customer and sign out all sessions?', false)) {
            $this->warn('No changes made.');

            return self::FAILURE;
        }

        DB::transaction(function () use ($user): void {
            $user->forceFill(['role' => UserRole::Customer])->save();
            DB::table(config('session.table', 'sessions'))->where('user_id', $user->getKey())->delete();
            AuditLog::create([
                'user_id' => $user->getKey(),
                'action' => 'admin.demoted',
                'entity_type' => 'user',
                'entity_id' => (string) $user->getKey(),
                'metadata' => ['via' => 'cli'],
                'created_at' => now(),
            ]);
        });

        $this->info('Administrator demoted: '.$email);

        return self::SUCCESS;
    }
}
