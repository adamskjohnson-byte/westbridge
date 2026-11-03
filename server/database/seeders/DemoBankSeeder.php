<?php

namespace Database\Seeders;

use App\Enums\AccountStatus;
use App\Enums\AccountType;
use App\Enums\CardStatus;
use App\Enums\CardType;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use App\Enums\UserRole;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\Card;
use App\Models\SupportTicket;
use App\Models\Transaction;
use App\Models\User;
use App\Services\AccountNumberGenerator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use LogicException;

class DemoBankSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            return;
        }

        $numberGenerator = app(AccountNumberGenerator::class);
        $customers = User::query()->where('role', UserRole::Customer->value)->get();

        foreach ($customers as $customer) {
            $checking = Account::create([
                'user_id' => $customer->id,
                'account_number' => $numberGenerator->generate(),
                'type' => AccountType::Checking,
                'nickname' => 'Everyday checking',
                'currency' => 'USD',
                'status' => AccountStatus::Active,
                'opened_at' => now()->subDays(110),
            ]);

            Account::create([
                'user_id' => $customer->id,
                'account_number' => $numberGenerator->generate(),
                'type' => AccountType::Savings,
                'nickname' => 'Rainy day savings',
                'currency' => 'USD',
                'status' => AccountStatus::Active,
                'opened_at' => now()->subDays(95),
            ]);

            $this->seedCheckingLedger($checking);

            Beneficiary::factory()->create([
                'user_id' => $customer->id,
                'name' => fake()->name(),
            ]);

            Card::create([
                'user_id' => $customer->id,
                'account_id' => $checking->id,
                'type' => CardType::Debit,
                'last4' => fake()->numerify('####'),
                'expiry_month' => fake()->numberBetween(1, 12),
                'expiry_year' => (int) now()->addYears(fake()->numberBetween(2, 5))->format('Y'),
                'nickname' => 'Everyday debit',
                'status' => CardStatus::Active,
                'daily_limit_cents' => 250000,
            ]);
        }

        foreach (array_slice($customers->all(), 0, 4) as $index => $customer) {
            SupportTicket::create([
                'user_id' => $customer->id,
                'name' => $customer->first_name.' '.$customer->last_name,
                'email' => $customer->email,
                'subject' => ['Card replacement', 'Savings goal question', 'Transfer timing', 'Statement request'][$index],
                'message' => 'Please help me review this demo account question. No real financial information is included.',
                'status' => $index === 0 ? TicketStatus::InProgress : TicketStatus::Open,
                'priority' => $index === 3 ? TicketPriority::High : TicketPriority::Normal,
            ]);

            AuditLog::create([
                'user_id' => $customer->id,
                'action' => 'demo.account_seeded',
                'entity_type' => 'user',
                'entity_id' => (string) $customer->id,
                'ip_address' => '192.0.2.'.($index + 10),
                'user_agent' => 'Westbridge Demo Seeder',
                'metadata' => ['fixture' => true],
                'created_at' => now(),
            ]);
        }
    }

    private function seedCheckingLedger(Account $account): void
    {
        $firstDay = CarbonImmutable::now()->subDays(89)->startOfDay();
        $events = [];

        for ($day = 0; $day < 90; $day++) {
            $date = $firstDay->addDays($day);

            if ($day % 14 === 0) {
                $events[] = $this->event($date, TransactionDirection::Credit, TransactionCategory::Deposit, fake()->numberBetween(285000, 360000), 'Payroll deposit', 'Northstar Design Cooperative');
            }
            if ($day % 7 === 4) {
                $events[] = $this->event($date->setTime(12, 0), TransactionDirection::Debit, TransactionCategory::Card, fake()->numberBetween(5500, 19000), 'Grocery market', 'Cedar Market');
            }
            if ($day % 30 === 7) {
                $events[] = $this->event($date->setTime(9, 0), TransactionDirection::Debit, TransactionCategory::BillPayment, 128000, 'Monthly rent', 'Maple Court Homes');
            }
            if ($day % 30 === 10) {
                $events[] = $this->event($date->setTime(10, 0), TransactionDirection::Debit, TransactionCategory::BillPayment, fake()->numberBetween(9000, 19500), 'Utilities payment', 'River City Utilities');
            }
            if ($day % 30 === 2) {
                $events[] = $this->event($date->setTime(11, 0), TransactionDirection::Debit, TransactionCategory::Card, fake()->numberBetween(1200, 3200), 'Monthly subscription', 'Juniper Streaming');
            }
            if ($day % 21 === 16) {
                $events[] = $this->event($date->setTime(15, 0), TransactionDirection::Debit, TransactionCategory::Transfer, fake()->numberBetween(7500, 22000), 'Transfer to savings goal', 'Westbridge savings');
            }
        }

        usort($events, static function (array $left, array $right): int {
            $leftOrder = [$left['posted_at']->getTimestamp(), $left['direction'] === TransactionDirection::Credit ? 0 : 1];
            $rightOrder = [$right['posted_at']->getTimestamp(), $right['direction'] === TransactionDirection::Credit ? 0 : 1];

            return $leftOrder <=> $rightOrder;
        });

        $balance = 0;
        foreach ($events as $event) {
            $balance += $event['direction'] === TransactionDirection::Credit ? $event['amount_cents'] : -$event['amount_cents'];
            if ($balance < 0) {
                throw new LogicException('Demo checking ledger unexpectedly went below zero.');
            }

            Transaction::create([
                'account_id' => $account->id,
                'direction' => $event['direction'],
                'amount_cents' => $event['amount_cents'],
                'balance_after_cents' => $balance,
                'category' => $event['category'],
                'description' => $event['description'],
                'counterparty_name' => $event['counterparty_name'],
                'reference' => (string) Str::ulid(),
                'posted_at' => $event['posted_at'],
                'created_at' => $event['posted_at'],
            ]);
        }

        $account->balance_cents = $balance;
        $account->save();
    }

    private function event(
        CarbonImmutable $postedAt,
        TransactionDirection $direction,
        TransactionCategory $category,
        int $amountCents,
        string $description,
        string $counterpartyName,
    ): array {
        return [
            'posted_at' => $postedAt,
            'direction' => $direction,
            'category' => $category,
            'amount_cents' => $amountCents,
            'description' => $description,
            'counterparty_name' => $counterpartyName,
        ];
    }
}
