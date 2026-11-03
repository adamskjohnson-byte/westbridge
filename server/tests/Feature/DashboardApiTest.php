<?php

namespace Tests\Feature;

use App\Enums\AccountStatus;
use App\Enums\AccountType;
use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use App\Enums\TransferStatus;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_list_masks_number_orders_open_accounts_first_and_detail_reveals_only_owner_number(): void
    {
        $user = User::factory()->create();
        $closed = Account::factory()->for($user)->create([
            'account_number' => '1111222233',
            'status' => AccountStatus::Closed,
        ]);
        $open = Account::factory()->for($user)->create([
            'account_number' => '9999887766',
            'status' => AccountStatus::Active,
            'balance_cents' => 52345,
        ]);
        $otherAccount = Account::factory()->create();

        $this->actingAs($user, 'web')->getJson('/api/v1/accounts')
            ->assertOk()
            ->assertJsonPath('data.0.id', $open->id)
            ->assertJsonPath('data.0.number_masked', '•••• 7766')
            ->assertJsonPath('data.0.balance_cents', 52345)
            ->assertJsonMissingPath('data.0.account_number')
            ->assertJsonPath('data.1.id', $closed->id)
            ->assertJsonMissing(['account_number' => $otherAccount->account_number]);

        $this->getJson('/api/v1/accounts/'.$open->id)
            ->assertOk()
            ->assertJsonPath('data.account_number', '9999887766')
            ->assertJsonPath('data.number_masked', '•••• 7766');

        $this->getJson('/api/v1/accounts/'.$otherAccount->id)
            ->assertNotFound()->assertJsonPath('code', 'not_found');
    }

    public function test_transaction_filters_support_literal_search_repeated_categories_dates_amounts_and_direction(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        $this->transaction($account, [
            'description' => 'Receipt 50%_\\path',
            'counterparty_name' => 'Market_One',
            'direction' => TransactionDirection::Debit,
            'category' => TransactionCategory::Card,
            'amount_cents' => 500,
            'posted_at' => '2026-02-02 10:00:00',
        ]);
        $nearMatch = $this->transaction($account, [
            'description' => 'Receipt 50XX\\path',
            'counterparty_name' => 'Market_One',
            'direction' => TransactionDirection::Debit,
            'category' => TransactionCategory::Card,
            'amount_cents' => 100,
            'posted_at' => '2026-02-03 10:00:00',
        ]);
        $bill = $this->transaction($account, [
            'description' => 'Rent payment',
            'counterparty_name' => 'Cedar Homes',
            'direction' => TransactionDirection::Debit,
            'category' => TransactionCategory::BillPayment,
            'amount_cents' => 123456,
            'posted_at' => '2026-02-04 10:00:00',
        ]);
        $credit = $this->transaction($account, [
            'description' => 'Salary payment',
            'direction' => TransactionDirection::Credit,
            'category' => TransactionCategory::Deposit,
            'amount_cents' => 250000,
            'posted_at' => '2026-02-05 10:00:00',
        ]);

        $this->actingAs($user, 'web')
            ->getJson('/api/v1/accounts/'.$account->id.'/transactions?'.http_build_query(['q' => '50%_\\path']))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.description', 'Receipt 50%_\\path');

        $this->getJson('/api/v1/accounts/'.$account->id.'/transactions?category=card&category=bill_payment&direction=debit&date_from=2026-02-02&date_to=2026-02-04&min_amount_cents=500&max_amount_cents=123456')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/v1/accounts/'.$account->id.'/transactions?direction=credit&category[]=deposit')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference', $credit->reference);

        $this->assertNotSame($nearMatch->reference, $bill->reference);
    }

    public function test_transaction_sort_and_pagination_return_expected_metadata(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        foreach ([300, 100, 200] as $amount) {
            $this->transaction($account, [
                'amount_cents' => $amount,
                'posted_at' => '2026-03-01 10:00:00',
            ]);
        }

        $response = $this->actingAs($user, 'web')
            ->getJson('/api/v1/accounts/'.$account->id.'/transactions?sort=amount_cents&order=asc&per_page=2')
            ->assertOk()
            ->assertJsonPath('meta.page', 1)
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.last_page', 2);
        $this->assertSame([100, 200], array_column($response->json('data'), 'amount_cents'));

        $secondPage = $this->getJson('/api/v1/accounts/'.$account->id.'/transactions?sort=amount_cents&order=asc&per_page=2&page=2')
            ->assertOk();
        $this->assertSame([300], array_column($secondPage->json('data'), 'amount_cents'));
    }

    public function test_filter_validation_uses_stable_keys(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        $base = '/api/v1/accounts/'.$account->id.'/transactions?';
        $this->actingAs($user, 'web');

        foreach ([
            ['date_from=2026-02-30', 'date_from', 'validation.date_invalid'],
            ['date_from=2026-03-02&date_to=2026-03-01', 'date_from', 'validation.date_range_order'],
            ['date_from=2020-01-01&date_to=2026-01-02', 'date_to', 'validation.date_range_max'],
            ['min_amount_cents=200&max_amount_cents=100', 'min_amount_cents', 'validation.amount_range_order'],
            ['per_page=51', 'per_page', 'validation.per_page_invalid'],
            ['direction=sideways', 'direction', 'validation.direction_invalid'],
            ['category=invalid', 'category', 'validation.category_invalid'],
            ['q='.str_repeat('x', 101), 'q', 'validation.query_max'],
        ] as [$query, $field, $key]) {
            $this->getJson($base.$query)
                ->assertUnprocessable()
                ->assertJsonPath('code', 'validation_failed')
                ->assertJsonPath('errors.'.$field.'.0', $key);
        }
    }

    public function test_foreign_account_and_transaction_reference_are_not_found(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $foreignAccount = Account::factory()->for($other)->create();
        $foreignTransaction = $this->transaction($foreignAccount);
        $this->actingAs($owner, 'web');

        $this->getJson('/api/v1/accounts/'.$foreignAccount->id)->assertNotFound()->assertJsonPath('code', 'not_found');
        $this->getJson('/api/v1/accounts/'.$foreignAccount->id.'/transactions')->assertNotFound()->assertJsonPath('code', 'not_found');
        $this->getJson('/api/v1/accounts/'.$foreignAccount->id.'/transactions/'.$foreignTransaction->reference)
            ->assertNotFound()->assertJsonPath('code', 'not_found');
        $this->get('/api/v1/accounts/'.$foreignAccount->id.'/transactions/export')
            ->assertNotFound();
    }

    public function test_reference_lookup_is_scoped_and_resource_has_no_account_internal_id(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        $transaction = $this->transaction($account, ['amount_cents' => 456]);

        $response = $this->actingAs($user, 'web')
            ->getJson('/api/v1/accounts/'.$account->id.'/transactions/'.$transaction->reference)
            ->assertOk()
            ->assertJsonPath('data.reference', $transaction->reference)
            ->assertJsonPath('data.amount_cents', 456)
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonMissingPath('data.account_id');

        $this->assertStringContainsString('T', $response->json('data.posted_at'));
        $this->getJson('/api/v1/accounts/'.$account->id.'/transactions/'.str_repeat('0', 26))
            ->assertNotFound()->assertJsonPath('code', 'not_found');
    }

    public function test_summary_aggregates_ledger_excludes_own_transfers_and_zero_fills_six_months(): void
    {
        CarbonImmutable::setTestNow('2026-11-03T12:00:00Z');
        try {
            $user = User::factory()->create();
            $checking = Account::factory()->for($user)->create(['balance_cents' => 40000]);
            $savings = Account::factory()->for($user)->create(['status' => AccountStatus::Frozen, 'balance_cents' => 10000]);
            Account::factory()->for($user)->create(['status' => AccountStatus::Closed, 'balance_cents' => 99999]);
            $outsider = Account::factory()->create();
            $current = '2026-11-02 12:00:00';

            $this->transaction($checking, ['direction' => TransactionDirection::Credit, 'category' => TransactionCategory::Deposit, 'amount_cents' => 25000, 'posted_at' => $current]);
            $this->transaction($checking, ['direction' => TransactionDirection::Debit, 'category' => TransactionCategory::Card, 'amount_cents' => 5000, 'posted_at' => $current]);
            $this->transaction($checking, ['direction' => TransactionDirection::Debit, 'category' => TransactionCategory::BillPayment, 'amount_cents' => 3000, 'posted_at' => $current]);

            $ownTransfer = Transfer::factory()->create([
                'initiated_by_user_id' => $user->id,
                'from_account_id' => $checking->id,
                'to_account_id' => $savings->id,
                'amount_cents' => 8000,
                'status' => TransferStatus::Completed,
                'idempotency_key' => null,
            ]);
            $this->transaction($checking, ['transfer_id' => $ownTransfer->id, 'direction' => TransactionDirection::Debit, 'category' => TransactionCategory::Transfer, 'amount_cents' => 8000, 'posted_at' => $current]);
            $this->transaction($savings, ['transfer_id' => $ownTransfer->id, 'direction' => TransactionDirection::Credit, 'category' => TransactionCategory::Transfer, 'amount_cents' => 8000, 'posted_at' => $current]);

            $externalTransfer = Transfer::factory()->create([
                'initiated_by_user_id' => $user->id,
                'from_account_id' => $checking->id,
                'to_account_id' => $outsider->id,
                'amount_cents' => 2000,
                'status' => TransferStatus::Completed,
                'idempotency_key' => null,
            ]);
            $this->transaction($checking, ['transfer_id' => $externalTransfer->id, 'direction' => TransactionDirection::Debit, 'category' => TransactionCategory::Transfer, 'amount_cents' => 2000, 'posted_at' => $current]);

            $seriesStart = CarbonImmutable::now('UTC')->startOfMonth()->subMonths(5);
            $this->transaction($checking, [
                'direction' => TransactionDirection::Credit,
                'category' => TransactionCategory::Interest,
                'amount_cents' => 11000,
                'posted_at' => $seriesStart->addDays(4),
            ]);

            $summary = $this->actingAs($user, 'web')->getJson('/api/v1/dashboard/summary')->assertOk();
            $summary->assertJsonPath('currency', 'USD')
                ->assertJsonPath('total_balance_cents', 50000)
                ->assertJsonPath('month.income_cents', 25000)
                ->assertJsonPath('month.spending_cents', 10000)
                ->assertJsonPath('month.net_cents', 15000)
                ->assertJsonPath('series.0.month', '2026-06')
                ->assertJsonPath('series.0.income_cents', 11000)
                ->assertJsonPath('series.1.income_cents', 0)
                ->assertJsonPath('series.1.spending_cents', 0)
                ->assertJsonPath('spending_by_category.0.category', 'card')
                ->assertJsonPath('spending_by_category.0.spending_cents', 5000)
                ->assertJsonPath('spending_by_category.1.category', 'bill_payment')
                ->assertJsonPath('spending_by_category.2.category', 'transfer')
                ->assertJsonMissingPath('recent.0.account_id');
            $this->assertCount(6, $summary->json('series'));
        } finally {
            CarbonImmutable::setTestNow();
        }
    }

    public function test_export_csv_has_bom_exact_amounts_filtered_rows_audit_and_safe_formula_cells(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create(['account_number' => '1234566248']);
        foreach ([5, 100, 123456] as $amount) {
            $this->transaction($account, [
                'direction' => TransactionDirection::Debit,
                'category' => TransactionCategory::Card,
                'amount_cents' => $amount,
                'balance_after_cents' => 900000 - $amount,
                'description' => $amount === 5 ? '=SUM(1,1)' : 'Card purchase',
                'counterparty_name' => $amount === 5 ? '@Shop' : 'Shop',
            ]);
        }
        $this->transaction($account, ['category' => TransactionCategory::Deposit, 'description' => 'Ignore this row']);

        $response = $this->actingAs($user, 'web')
            ->get('/api/v1/accounts/'.$account->id.'/transactions/export?category=card')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringStartsWith("\xEF\xBB\xBFdate,reference,description,counterparty,category,direction,amount,currency,balance_after", $response->streamedContent());
        $this->assertStringContainsString('filename=westbridge-6248-'.now('UTC')->format('Ymd').'.csv', $response->headers->get('content-disposition'));

        $csv = substr($response->streamedContent(), 3);
        $lines = preg_split('/\r\n|\n|\r/', trim($csv));
        $parsed = array_map(static fn (string $line): array => str_getcsv($line), $lines);
        $this->assertSame(['0.05', '1.00', '1234.56'], array_column(array_slice($parsed, 1), 6));
        $this->assertSame("'=SUM(1,1)", array_slice($parsed, 1)[0][2]);
        $this->assertSame("'@Shop", array_slice($parsed, 1)[0][3]);
        $audit = AuditLog::query()->where('action', 'transactions_exported')->firstOrFail();
        $this->assertSame(3, $audit->metadata['row_count']);
        $this->assertSame(['card'], $audit->metadata['filters']['category']);
    }

    public function test_export_is_capped_and_sets_truncated_header(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        $rows = [];
        for ($index = 0; $index < 10001; $index++) {
            $rows[] = [
                'account_id' => $account->id,
                'direction' => 'debit',
                'amount_cents' => 5,
                'balance_after_cents' => 0,
                'category' => 'card',
                'description' => 'Purchase '.$index,
                'counterparty_name' => 'Shop',
                'reference' => (string) Str::ulid(),
                'posted_at' => now()->subMinutes($index),
                'created_at' => now()->subMinutes($index),
            ];
            if (count($rows) === 500) {
                DB::table('transactions')->insert($rows);
                $rows = [];
            }
        }
        if ($rows !== []) {
            DB::table('transactions')->insert($rows);
        }

        $response = $this->actingAs($user, 'web')
            ->get('/api/v1/accounts/'.$account->id.'/transactions/export')
            ->assertOk()
            ->assertHeader('X-Export-Truncated', 'true');
        $lines = preg_split('/\r\n|\n|\r/', trim(substr($response->streamedContent(), 3)));
        $this->assertCount(10001, $lines);
        $this->assertSame(10000, AuditLog::query()->where('action', 'transactions_exported')->firstOrFail()->metadata['row_count']);
    }

    public function test_export_is_throttled_ten_times_per_user_per_minute(): void
    {
        $user = User::factory()->create();
        $account = Account::factory()->for($user)->create();
        $this->actingAs($user, 'web');

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->get('/api/v1/accounts/'.$account->id.'/transactions/export')->assertOk();
        }

        $this->getJson('/api/v1/accounts/'.$account->id.'/transactions/export')
            ->assertTooManyRequests()->assertJsonPath('code', 'too_many_requests');
        $this->assertSame(10, AuditLog::query()->where('action', 'transactions_exported')->count());
    }

    public function test_dashboard_lists_and_transaction_pagination_have_constant_query_counts(): void
    {
        $user = User::factory()->create();
        $accounts = Account::factory()->count(10)->for($user)->create();
        $account = $accounts->first();
        Transaction::factory()->count(40)->for($account)->create();
        $accountQueries = $this->watchQueries('accounts');
        $transactionQueries = $this->watchQueries('transactions');
        $this->actingAs($user, 'web');

        $beforeAccounts = $accountQueries();
        $this->getJson('/api/v1/accounts')->assertOk();
        $accountListQueries = $accountQueries() - $beforeAccounts;

        $beforeTransactions = $transactionQueries();
        $this->getJson('/api/v1/accounts/'.$account->id.'/transactions?per_page=50')->assertOk();
        $transactionListQueries = $transactionQueries() - $beforeTransactions;

        $this->assertSame(1, $accountListQueries);
        $this->assertSame(2, $transactionListQueries);
    }

    public function test_filter_explain_plans_use_posted_category_and_direction_indexes(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            $posted = DB::select('EXPLAIN SELECT * FROM transactions WHERE account_id = ? AND posted_at >= ?', [1, '2026-01-01']);
            $category = DB::select('EXPLAIN SELECT * FROM transactions WHERE account_id = ? AND category = ? AND posted_at >= ?', [1, 'card', '2026-01-01']);
            $direction = DB::select('EXPLAIN SELECT * FROM transactions WHERE account_id = ? AND direction = ? AND posted_at >= ?', [1, 'debit', '2026-01-01']);

            $this->assertStringContainsString('transactions_account_id_posted_at_index', json_encode($posted));
            $this->assertStringContainsString('transactions_account_category_posted_index', json_encode($category));
            $this->assertStringContainsString('transactions_account_direction_posted_index', json_encode($direction));

            return;
        }

        $posted = DB::select('EXPLAIN QUERY PLAN SELECT * FROM transactions WHERE account_id = ? AND posted_at >= ?', [1, '2026-01-01']);
        $category = DB::select('EXPLAIN QUERY PLAN SELECT * FROM transactions WHERE account_id = ? AND category = ? AND posted_at >= ?', [1, 'card', '2026-01-01']);
        $direction = DB::select('EXPLAIN QUERY PLAN SELECT * FROM transactions WHERE account_id = ? AND direction = ? AND posted_at >= ?', [1, 'debit', '2026-01-01']);

        $this->assertStringContainsString('transactions_account_id_posted_at_index', json_encode($posted));
        $this->assertStringContainsString('transactions_account_category_posted_index', json_encode($category));
        $this->assertStringContainsString('transactions_account_direction_posted_index', json_encode($direction));
    }

    public function test_demo_activity_command_is_local_only_and_reconciles_a_fresh_registered_user(): void
    {
        $user = User::factory()->create();
        $checking = Account::factory()->for($user)->create([
            'type' => AccountType::Checking,
            'balance_cents' => 100000,
            'account_number' => '1234561111',
        ]);
        $savings = Account::factory()->for($user)->create([
            'type' => AccountType::Savings,
            'balance_cents' => 0,
            'account_number' => '1234562222',
        ]);
        Transaction::factory()->for($checking)->create([
            'direction' => TransactionDirection::Credit,
            'amount_cents' => 100000,
            'balance_after_cents' => 100000,
            'category' => TransactionCategory::Deposit,
            'description' => 'Westbridge welcome bonus',
            'counterparty_name' => 'Westbridge Welcome Bonus',
            'posted_at' => now(),
        ]);

        $this->app['env'] = 'testing';
        $this->artisan('dev:demo-activity '.$user->email)
            ->expectsOutput('This command is available only when APP_ENV=local.')
            ->assertExitCode(1);

        $this->app['env'] = 'local';
        $this->artisan('dev:demo-activity '.$user->email.' --days=90')->assertExitCode(0);

        $this->assertGreaterThan(20, Transaction::query()->whereIn('account_id', [$checking->id, $savings->id])->count());
        $this->assertGreaterThan(0, Transaction::query()->where('account_id', $checking->id)->where('category', TransactionCategory::BillPayment)->count());
        $this->assertGreaterThan(0, Transaction::query()->where('account_id', $checking->id)->where('category', TransactionCategory::Card)->count());
        $this->assertGreaterThan(0, Transaction::query()->whereNotNull('transfer_id')->count());
        $this->artisan('bank:reconcile')->assertExitCode(0);
    }

    private function transaction(Account $account, array $overrides = []): Transaction
    {
        return Transaction::factory()->for($account)->create($overrides);
    }

    private function watchQueries(string $table): \Closure
    {
        $count = 0;
        DB::listen(static function (QueryExecuted $query) use ($table, &$count): void {
            if (preg_match('/\bfrom\s+["`]?'.$table.'["`]?(?:\s|$)/i', $query->sql) === 1) {
                $count++;
            }
        });

        return static function () use (&$count): int {
            return $count;
        };
    }
}
