<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillPayment extends Model
{
    use HasFactory;
    use HasUlids;

    public $incrementing = false;

    public const UPDATED_AT = null;

    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'account_id',
        'biller_code',
        'biller_name',
        'reference_number',
        'amount_cents',
        'status',
        'transaction_id',
        'idempotency_key',
        'request_hash',
        'created_at',
    ];

    protected function casts(): array
    {
        return ['amount_cents' => 'integer', 'created_at' => 'immutable_datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
