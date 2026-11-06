<?php

namespace App\Models;

use App\Enums\TransferStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transfer extends Model
{
    use HasFactory;
    use HasUlids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'initiated_by_user_id',
        'from_account_id',
        'to_account_id',
        'destination_type',
        'destination_name',
        'destination_number_masked',
        'destination_holder_masked',
        'amount_cents',
        'currency',
        'memo',
        'status',
        'failure_reason',
        'idempotency_key',
        'request_hash',
    ];

    protected function casts(): array
    {
        return [
            'status' => TransferStatus::class,
            'amount_cents' => 'integer',
        ];
    }

    public function initiatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by_user_id');
    }

    public function fromAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'from_account_id');
    }

    public function toAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'to_account_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'transfer_id');
    }
}
