<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\AuditLog;
use App\Models\SupportTicket;
use App\Models\Transaction;
use App\Models\User;
use App\Services\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_overview_and_reconciliation_smoke(): void
    {
        $admin = User::factory()->admin()->create();
        $customer = User::factory()->create();
        $account = Account::factory()->for($customer)->create(['balance_cents' => 0]);
        $this->credit($account, 1000);
        $this->actingAs($admin, 'web')->getJson('/api/v1/admin/overview')->assertOk()
            ->assertJsonPath('data.users_total', 2)->assertJsonPath('data.total_balance_cents', 1000);
        $this->getJson('/api/v1/admin/system/reconcile')->assertOk()->assertJsonPath('data.ok', true)->assertJsonPath('data.accounts_checked', 1);
        DB::table('accounts')->where('id', $account->id)->update(['balance_cents' => 900]);
        $this->getJson('/api/v1/admin/system/reconcile')->assertOk()->assertJsonPath('data.ok', false)
            ->assertJsonPath('data.mismatches.0.number_masked', '•••• '.substr($account->account_number, -4));
    }

    public function test_user_filters_shape_pagination_and_query_count_are_constant(): void
    {
        $admin = User::factory()->admin()->create();
        $first = User::factory()->create(['first_name' => 'Avery', 'email' => 'avery@example.test']);
        $account = Account::factory()->for($first)->create(['balance_cents' => 2500]);
        User::factory()->count(5)->create();
        $this->actingAs($admin, 'web');
        $smallQueryCount = $this->countQueries(fn () => $this->getJson('/api/v1/admin/users?q=Avery&status=active&role=customer&verified=1&sort=name&order=asc')->assertOk()
            ->assertJsonPath('data.0.email', 'avery@example.test')->assertJsonPath('data.0.accounts_count', 1)->assertJsonPath('data.0.total_balance_cents', 2500));
        User::factory()->count(10)->create();
        $largeQueryCount = $this->countQueries(fn () => $this->getJson('/api/v1/admin/users?per_page=5')->assertOk()->assertJsonPath('meta.per_page', 5));
        $this->assertSame($smallQueryCount, $largeQueryCount);

        $this->getJson('/api/v1/admin/users?q=%')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/admin/users?per_page=101')->assertUnprocessable();
    }

    public function test_user_detail_masks_accounts_and_includes_related_counts_and_recent_rows(): void
    {
        $admin = User::factory()->admin()->create();
        $customer = User::factory()->create();
        $account = Account::factory()->for($customer)->create(['account_number' => '2345678910', 'balance_cents' => 500]);
        $this->credit($account, 500);
        SupportTicket::factory()->create(['user_id' => $customer->id]);

        $this->actingAs($admin, 'web')->getJson('/api/v1/admin/users/'.$customer->id)->assertOk()
            ->assertJsonPath('data.email', $customer->email)
            ->assertJsonPath('data.accounts.0.number_masked', '•••• 8910')
            ->assertJsonPath('data.open_tickets_count', 1)
            ->assertJsonPath('data.transactions.0.amount_cents', 500);
    }

    public function test_transaction_filters_large_flag_and_redacted_account_details(): void
    {
        config(['bank.admin_large_transaction_cents' => 500]);
        $admin = User::factory()->admin()->create();
        $customer = User::factory()->create(['email' => 'ledger@example.test']);
        $account = Account::factory()->for($customer)->create(['account_number' => '3456789012', 'balance_cents' => 800]);
        $small = $this->credit($account, 300, 'Small reference');
        $large = $this->credit($account, 500, 'Large reference');
        $this->actingAs($admin, 'web');
        $this->getJson('/api/v1/admin/transactions?user_email=ledger%40example.test&direction=credit&category=deposit&large_only=1&min_amount_cents=500')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.reference', $large->reference)
            ->assertJsonPath('data.0.flagged_large', true)->assertJsonPath('data.0.account.number_masked', '•••• 9012');
        $this->getJson('/api/v1/admin/transactions?q=Small')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $small->id);
    }

    public function test_ticket_filters_updates_internal_notes_and_emails_replies_without_notes(): void
    {
        Mail::fake();
        $admin = User::factory()->admin()->create();
        $ticket = SupportTicket::factory()->create(['email' => 'ticket@example.test', 'subject' => 'Card help', 'status' => 'closed', 'priority' => 'normal']);
        SupportTicket::factory()->create(['subject' => 'Other issue', 'status' => 'open', 'priority' => 'low']);
        $this->actingAs($admin, 'web');
        $this->getJson('/api/v1/admin/tickets?status=closed&priority=normal&q=Card')->assertOk()->assertJsonPath('meta.total', 1);
        $write = ['reason' => 'Reviewed case with customer', 'password' => 'Password123!'];
        $this->patchJson('/api/v1/admin/tickets/'.$ticket->id, [...$write, 'priority' => 'high'])->assertOk()->assertJsonPath('data.priority', 'high');
        $this->postJson('/api/v1/admin/tickets/'.$ticket->id.'/messages', [...$write, 'type' => 'note', 'body' => 'Private internal note'])->assertCreated();
        Mail::assertNothingOutgoing();
        $this->postJson('/api/v1/admin/tickets/'.$ticket->id.'/messages', [...$write, 'type' => 'reply', 'body' => 'Customer facing reply'])->assertCreated();
        $ticket->refresh();
        $this->assertSame('in_progress', $ticket->status->value);
        Mail::assertSent(\App\Mail\TicketReplyMail::class, fn ($mail) => $mail->hasTo('ticket@example.test') && $mail->reply === 'Customer facing reply');
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'admin.ticket_note_added']);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'admin.ticket_reply_sent']);
        $this->getJson('/api/v1/admin/tickets/'.$ticket->id)->assertOk()->assertJsonFragment(['type' => 'note', 'body' => 'Private internal note'])->assertJsonFragment(['type' => 'reply', 'body' => 'Customer facing reply']);
    }

    public function test_audit_filters_exact_prefix_and_actions_dropdown(): void
    {
        $admin = User::factory()->admin()->create();
        AuditLog::create(['user_id' => $admin->id, 'action' => 'admin.user_suspended', 'entity_type' => 'user', 'entity_id' => '23', 'ip_address' => '192.0.2.1', 'user_agent' => str_repeat('Agent', 40), 'metadata' => ['reason' => 'test'], 'created_at' => now()]);
        AuditLog::create(['user_id' => $admin->id, 'action' => 'admin.account_frozen', 'entity_type' => 'account', 'entity_id' => '7', 'created_at' => now()->subMinute()]);
        $this->actingAs($admin, 'web')->getJson('/api/v1/admin/audit-logs?action=admin.user_suspended&actor_email='.$admin->email.'&entity_type=user&entity_id=23')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.actor.email', $admin->email)->assertJsonPath('data.0.user_agent', str_repeat('Agent', 24));
        $this->getJson('/api/v1/admin/audit-logs?action=admin.*')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/v1/admin/audit-logs/actions')->assertOk()->assertJsonFragment(['admin.user_suspended']);
    }

    private function credit(Account $account, int $amount, string $description = 'Admin test credit'): Transaction
    {
        return app(LedgerService::class)->deposit($account, $amount, $description);
    }

    private function countQueries(callable $callback): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $callback();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();
        return $count;
    }
}
