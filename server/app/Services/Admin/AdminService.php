<?php

namespace App\Services\Admin;

use App\Enums\AccountStatus;
use App\Enums\TicketStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Mail\TicketReplyMail;
use App\Models\Account;
use App\Models\AuditLog;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class AdminService
{
    public static function maskAccountNumber(string $number): string
    {
        return '•••• '.substr($number, -4);
    }

    public function overview(): array
    {
        $since7 = now()->subDays(7);
        $since24 = now()->subDay();
        $transactionTotals = DB::table('transactions')->where('posted_at', '>=', $since24)
            ->selectRaw('COUNT(*) as transactions_count, COALESCE(SUM(amount_cents), 0) as volume_cents')
            ->selectRaw('SUM(CASE WHEN amount_cents >= ? THEN 1 ELSE 0 END) as large_count', [(int) config('bank.admin_large_transaction_cents')])->first();

        return [
            'users_total' => (int) User::query()->count(),
            'users_new_7d' => (int) User::query()->where('created_at', '>=', $since7)->count(),
            'users_suspended' => (int) User::query()->where('status', UserStatus::Suspended)->count(),
            'tickets_open' => (int) SupportTicket::query()->whereIn('status', [TicketStatus::Open, TicketStatus::InProgress])->count(),
            'transactions_24h' => (int) ($transactionTotals->transactions_count ?? 0),
            'volume_24h_cents' => (int) ($transactionTotals->volume_cents ?? 0),
            'total_balance_cents' => (int) Account::query()->sum('balance_cents'),
            'failed_logins_24h' => (int) AuditLog::query()->where('action', 'login_failed')->where('created_at', '>=', $since24)->count(),
            'large_transactions_24h' => (int) ($transactionTotals->large_count ?? 0),
            'latest_audit' => AuditLog::query()->with('user')->latest('created_at')->limit(5)->get(),
        ];
    }

    public function reconcile(User $admin, Request $request): array
    {
        $accounts = Account::query()->orderBy('id')->get(['id', 'user_id', 'account_number', 'balance_cents']);
        $ledger = DB::table('transactions')->select('account_id')
            ->selectRaw('SUM(CASE WHEN direction = ? THEN amount_cents ELSE -amount_cents END) as ledger_sum_cents', ['credit'])
            ->selectRaw('MAX(posted_at) as last_posted_at')->groupBy('account_id')->get()->keyBy('account_id');
        $latestBalances = DB::table('transactions')->select('account_id', 'balance_after_cents', 'posted_at', 'id')
            ->orderBy('posted_at')->orderBy('id')->get()->groupBy('account_id')
            ->map(fn ($rows) => $rows->last());
        $mismatches = [];
        foreach ($accounts as $account) {
            $ledgerSum = (int) ($ledger->get($account->id)->ledger_sum_cents ?? 0);
            $latest = $latestBalances->get($account->id);
            if ((int) $account->balance_cents !== $ledgerSum || (int) ($latest?->balance_after_cents ?? 0) !== (int) $account->balance_cents) {
                $mismatches[] = [
                    'account_id' => (int) $account->id,
                    'number_masked' => self::maskAccountNumber($account->account_number),
                    'balance_cents' => (int) $account->balance_cents,
                    'ledger_sum_cents' => $ledgerSum,
                ];
            }
        }
        $result = ['ok' => $mismatches === [], 'accounts_checked' => $accounts->count(), 'mismatches' => $mismatches];
        $this->audit($admin, 'admin.reconcile_run', 'system', null, ['ok' => $result['ok'], 'accounts_checked' => $result['accounts_checked'], 'mismatch_count' => count($mismatches)], $request);

        return $result;
    }

    public function users(array $filters): LengthAwarePaginator
    {
        $query = User::query()->withCount('accounts')->withSum('accounts as total_balance_cents', 'balance_cents');
        if (($filters['q'] ?? '') !== '') {
            $tokens = preg_split('/\s+/u', trim($filters['q']), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            foreach ($tokens as $token) {
                $pattern = '%'.self::escapeLike(mb_strtolower($token)).'%';
                $query->where(fn (EloquentBuilder $builder) => $builder
                    ->whereRaw("LOWER(first_name) LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("LOWER(last_name) LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("LOWER(email) LIKE ? ESCAPE '!'", [$pattern]));
            }
        }
        if (isset($filters['status'])) $query->where('status', $filters['status']);
        if (isset($filters['role'])) $query->where('role', $filters['role']);
        if (isset($filters['verified'])) {
            $filters['verified'] ? $query->whereNotNull('email_verified_at') : $query->whereNull('email_verified_at');
        }
        $sort = $filters['sort'] ?? 'created_at';
        if ($sort === 'name') $query->orderBy('last_name', $filters['order'] ?? 'desc')->orderBy('first_name', $filters['order'] ?? 'desc');
        else $query->orderBy($sort, $filters['order'] ?? 'desc');

        return $query->paginate($filters['per_page'] ?? 20)->withQueryString();
    }

    public function userDetail(User $user): array
    {
        $user->load(['accounts' => fn ($query) => $query->orderBy('id')])->loadCount([
            'cards',
            'supportTickets as open_tickets_count' => fn ($query) => $query->whereIn('status', ['open', 'in_progress']),
        ]);
        $accountIds = $user->accounts->modelKeys();
        $transactions = DB::table('transactions')->join('accounts', 'accounts.id', '=', 'transactions.account_id')
            ->join('users', 'users.id', '=', 'accounts.user_id')->whereIn('accounts.id', $accountIds)
            ->select([
                'transactions.id', 'transactions.account_id', 'transactions.transfer_id', 'transactions.direction', 'transactions.amount_cents',
                'transactions.balance_after_cents', 'transactions.category', 'transactions.description', 'transactions.counterparty_name',
                'transactions.reference', 'transactions.posted_at', 'accounts.type as account_type', 'accounts.account_number',
                'users.id as user_id', 'users.first_name as user_first_name', 'users.last_name as user_last_name', 'users.email as user_email',
            ])->orderByDesc('transactions.posted_at')->orderByDesc('transactions.id')->limit(10)->get();
        $audit = AuditLog::query()->with('user')
            ->where(fn ($query) => $query->where('user_id', $user->id)
                ->orWhere(fn ($entity) => $entity->where('entity_type', 'user')->where('entity_id', (string) $user->id)))
            ->latest('created_at')->limit(10)->get();
        $activeAfter = now()->subMinutes((int) config('session.lifetime'))->timestamp;
        $activeSessions = DB::table(config('session.table', 'sessions'))->where('user_id', $user->id)->where('last_activity', '>=', $activeAfter)->count();

        return compact('user', 'transactions', 'audit', 'activeSessions');
    }

    public function suspendOrReactivate(User $admin, User $target, bool $suspend, array $data, Request $request): void
    {
        $this->assertAdminWrite($admin, $data);
        if ($target->id === $admin->id || $target->role === UserRole::Admin) $this->validation('user', 'validation.cannot_modify_admin');
        $desired = $suspend ? UserStatus::Suspended : UserStatus::Active;
        if ($target->status === $desired) $this->validation('user', 'validation.already_in_state');
        DB::transaction(function () use ($admin, $target, $suspend, $desired, $data, $request): void {
            $target->forceFill(['status' => $desired])->save();
            if ($suspend) DB::table(config('session.table', 'sessions'))->where('user_id', $target->id)->delete();
            $this->audit($admin, $suspend ? 'admin.user_suspended' : 'admin.user_reactivated', 'user', (string) $target->id, [
                'target_user_id' => (int) $target->id,
                'reason' => $data['reason'],
            ], $request);
        });
    }

    public function freezeOrUnfreeze(User $admin, Account $account, bool $freeze, array $data, Request $request): void
    {
        $this->assertAdminWrite($admin, $data);
        $account->loadMissing('user');
        if ($account->user->id === $admin->id || $account->user->role === UserRole::Admin) $this->validation('account', 'validation.cannot_modify_admin');
        if ($account->status === AccountStatus::Closed) $this->validation('account', 'validation.account_closed');
        $desired = $freeze ? AccountStatus::Frozen : AccountStatus::Active;
        if ($account->status === $desired) $this->validation('account', 'validation.already_in_state');
        DB::transaction(function () use ($admin, $account, $freeze, $desired, $data, $request): void {
            $account->forceFill(['status' => $desired])->save();
            $this->audit($admin, $freeze ? 'admin.account_frozen' : 'admin.account_unfrozen', 'account', (string) $account->id, [
                'target_account_id' => (int) $account->id,
                'reason' => $data['reason'],
            ], $request);
        });
    }

    public function transactions(array $filters): LengthAwarePaginator
    {
        $query = DB::table('transactions')->join('accounts', 'accounts.id', '=', 'transactions.account_id')
            ->join('users', 'users.id', '=', 'accounts.user_id')
            ->select([
                'transactions.id', 'transactions.account_id', 'transactions.transfer_id', 'transactions.direction', 'transactions.amount_cents',
                'transactions.balance_after_cents', 'transactions.category', 'transactions.description', 'transactions.counterparty_name',
                'transactions.reference', 'transactions.posted_at', 'accounts.type as account_type', 'accounts.account_number',
                'users.id as user_id', 'users.first_name as user_first_name', 'users.last_name as user_last_name', 'users.email as user_email',
            ]);
        if (($filters['q'] ?? '') !== '') {
            $pattern = '%'.self::escapeLike(mb_strtolower($filters['q'])).'%';
            $query->where(fn ($builder) => $builder->whereRaw("LOWER(transactions.reference) LIKE ? ESCAPE '!'", [$pattern])
                ->orWhereRaw("LOWER(transactions.description) LIKE ? ESCAPE '!'", [$pattern])
                ->orWhereRaw("LOWER(transactions.counterparty_name) LIKE ? ESCAPE '!'", [$pattern]));
        }
        if (($filters['user_email'] ?? '') !== '') $query->whereRaw("LOWER(users.email) LIKE ? ESCAPE '!'", ['%'.self::escapeLike(mb_strtolower($filters['user_email'])).'%']);
        foreach (['direction', 'category'] as $field) if (isset($filters[$field])) $query->where('transactions.'.$field, $filters[$field]);
        foreach (['date_from' => '>=', 'date_to' => '<='] as $field => $operator) if (isset($filters[$field])) $query->whereDate('transactions.posted_at', $operator, $filters[$field]);
        if (isset($filters['min_amount_cents'])) $query->where('transactions.amount_cents', '>=', $filters['min_amount_cents']);
        if (isset($filters['max_amount_cents'])) $query->where('transactions.amount_cents', '<=', $filters['max_amount_cents']);
        if (! empty($filters['large_only'])) $query->where('transactions.amount_cents', '>=', (int) config('bank.admin_large_transaction_cents'));
        $sort = $filters['sort'] ?? 'posted_at';
        if ($sort === 'amount_cents') $query->orderBy('transactions.amount_cents', $filters['order'] ?? 'desc');
        else $query->orderBy('transactions.posted_at', $filters['order'] ?? 'desc');
        $query->orderBy('transactions.id', 'desc');

        return $query->paginate($filters['per_page'] ?? 20)->withQueryString();
    }

    public function tickets(array $filters): LengthAwarePaginator
    {
        $query = SupportTicket::query()->with('user')->orderByDesc('created_at')->orderByDesc('id');
        foreach (['status', 'priority'] as $field) if (isset($filters[$field])) $query->where($field, $filters[$field]);
        if (($filters['q'] ?? '') !== '') {
            $pattern = '%'.self::escapeLike(mb_strtolower($filters['q'])).'%';
            $query->where(fn ($builder) => $builder->whereRaw("LOWER(subject) LIKE ? ESCAPE '!'", [$pattern])
                ->orWhereRaw("LOWER(name) LIKE ? ESCAPE '!'", [$pattern])->orWhereRaw("LOWER(email) LIKE ? ESCAPE '!'", [$pattern]));
        }
        if (isset($filters['date_from'])) $query->whereDate('created_at', '>=', $filters['date_from']);
        if (isset($filters['date_to'])) $query->whereDate('created_at', '<=', $filters['date_to']);

        return $query->paginate($filters['per_page'] ?? 20)->withQueryString();
    }

    public function updateTicket(User $admin, SupportTicket $ticket, array $data, Request $request): SupportTicket
    {
        $this->assertAdminWrite($admin, $data);
        $changes = [];
        foreach (['status', 'priority'] as $field) {
            if (isset($data[$field]) && $ticket->{$field}->value !== $data[$field]) {
                $changes[$field] = ['from' => $ticket->{$field}->value, 'to' => $data[$field]];
                $ticket->{$field} = $data[$field];
            }
        }
        if ($changes !== []) {
            $ticket->save();
            $this->audit($admin, 'admin.ticket_updated', 'support_ticket', (string) $ticket->id, [
                'target_ticket_id' => (int) $ticket->id,
                'reason' => $data['reason'],
                'changes' => $changes,
            ], $request);
        }

        return $ticket->load(['user', 'messages.admin']);
    }

    public function addTicketMessage(User $admin, SupportTicket $ticket, array $data, Request $request): SupportTicketMessage
    {
        $this->assertAdminWrite($admin, $data);
        return DB::transaction(function () use ($admin, $ticket, $data, $request): SupportTicketMessage {
            $message = $ticket->messages()->create([
                'admin_id' => $admin->id,
                'type' => $data['type'],
                'body' => $data['body'],
                'created_at' => now(),
            ]);
            if ($data['type'] === 'reply') {
                if ($ticket->status === TicketStatus::Closed) {
                    $ticket->status = TicketStatus::InProgress;
                    $ticket->save();
                }
                DB::afterCommit(static fn () => Mail::to($ticket->email)->send(new TicketReplyMail($ticket->subject, $message->body)));
            }
            $this->audit($admin, $data['type'] === 'note' ? 'admin.ticket_note_added' : 'admin.ticket_reply_sent', 'support_ticket', (string) $ticket->id, [
                'target_ticket_id' => (int) $ticket->id,
                'reason' => $data['reason'],
                'message_id' => (int) $message->id,
            ], $request);

            return $message->load('admin');
        });
    }

    public function auditLogs(array $filters): LengthAwarePaginator
    {
        $query = AuditLog::query()->with('user')->orderByDesc('created_at')->orderByDesc('id');
        if (($filters['action'] ?? '') !== '') {
            $action = $filters['action'];
            str_ends_with($action, '*')
                ? $query->where('action', 'like', self::escapeLike(substr($action, 0, -1)).'%')
                : $query->where('action', $action);
        }
        if (($filters['actor_email'] ?? '') !== '') $query->whereHas('user', fn ($user) => $user->whereRaw("LOWER(email) LIKE ? ESCAPE '!'", ['%'.self::escapeLike(mb_strtolower($filters['actor_email'])).'%']));
        foreach (['entity_type', 'entity_id', 'ip_address'] as $field) if (($filters[$field] ?? '') !== '') $query->where($field, 'like', '%'.self::escapeLike($filters[$field]).'%');
        if (isset($filters['date_from'])) $query->whereDate('created_at', '>=', $filters['date_from']);
        if (isset($filters['date_to'])) $query->whereDate('created_at', '<=', $filters['date_to']);

        return $query->paginate($filters['per_page'] ?? 20)->withQueryString();
    }

    public function actions(): array
    {
        return AuditLog::query()->whereNotNull('action')->distinct()->orderBy('action')->pluck('action')->all();
    }

    public function assertAdminWrite(User $admin, array $data): void
    {
        if (! Hash::check($data['password'], $admin->password)) {
            $this->validation('password', 'validation.current_password_invalid');
        }
    }

    private static function escapeLike(string $value): string
    {
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value);
    }

    private function validation(string $field, string $key): never
    {
        throw ValidationException::withMessages([$field => [$key]]);
    }

    private function audit(User $actor, string $action, ?string $entityType, ?string $entityId, array $metadata, Request $request): void
    {
        AuditLog::create([
            'user_id' => $actor->id,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'metadata' => $metadata,
            'created_at' => now(),
        ]);
    }
}
