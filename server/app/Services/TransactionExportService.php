<?php

namespace App\Services;

use App\Models\Account;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TransactionExportService
{
    private const MAX_ROWS = 10000;

    public function __construct(private readonly TransactionReadService $transactions) {}

    public function export(User $user, Account $account, array $filters, Request $request): StreamedResponse
    {
        $query = $this->transactions->exportQuery($user, $account, $filters);
        $matchingRows = (int) (clone $query)->count('transactions.id');
        $rowCount = min($matchingRows, self::MAX_ROWS);
        $truncated = $matchingRows > self::MAX_ROWS;

        AuditLog::create([
            'user_id' => $user->getKey(),
            'action' => 'transactions_exported',
            'entity_type' => 'account',
            'entity_id' => (string) $account->getKey(),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'metadata' => ['filters' => $filters, 'row_count' => $rowCount],
            'created_at' => now(),
        ]);

        $filename = sprintf(
            'westbridge-%s-%s.csv',
            substr($account->account_number, -4),
            CarbonImmutable::now('UTC')->format('Ymd'),
        );
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store',
        ];
        if ($truncated) {
            $headers['X-Export-Truncated'] = 'true';
        }

        return response()->streamDownload(static function () use ($query): void {
            $stream = fopen('php://output', 'w');
            fwrite($stream, "\xEF\xBB\xBF");
            fputcsv($stream, ['date', 'reference', 'description', 'counterparty', 'category', 'direction', 'amount', 'currency', 'balance_after'], ',', '"', '\\');
            $written = 0;

            $query->select([
                'transactions.id', 'transactions.reference', 'transactions.description',
                'transactions.counterparty_name', 'transactions.category', 'transactions.direction',
                'transactions.amount_cents', 'transactions.balance_after_cents', 'transactions.posted_at',
                'transaction_accounts.currency as currency',
            ])->chunkById(1000, static function ($transactions) use ($stream, &$written): bool {
                foreach ($transactions as $transaction) {
                    if ($written >= self::MAX_ROWS) {
                        return false;
                    }

                    fputcsv($stream, [
                        self::safeText(CarbonImmutable::parse($transaction->posted_at, 'UTC')->utc()->toISOString()),
                        self::safeText($transaction->reference),
                        self::safeText($transaction->description),
                        self::safeText((string) $transaction->counterparty_name),
                        self::safeText($transaction->category),
                        self::safeText($transaction->direction),
                        self::centsAsDecimalString((int) $transaction->amount_cents),
                        self::safeText($transaction->currency),
                        self::centsAsDecimalString((int) $transaction->balance_after_cents),
                    ], ',', '"', '\\');
                    $written++;
                }

                return $written < self::MAX_ROWS;
            }, 'transactions.id', 'id');

            fclose($stream);
        }, $filename, $headers);
    }

    private static function centsAsDecimalString(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }

    private static function safeText(string $value): string
    {
        return preg_match('/^[=+@\-\t\r]/', $value) === 1 ? "'".$value : $value;
    }
}
