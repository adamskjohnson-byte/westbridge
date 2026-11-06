<?php

namespace App\Models;

use App\Enums\AccountStatus;
use App\Enums\AccountType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    use HasFactory;

    protected $attributes = [
        'balance_cents' => 0,
        'currency' => 'USD',
    ];

    protected $fillable = [
        'user_id',
        'account_number',
        'type',
        'nickname',
        'currency',
        'status',
        'opened_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => AccountType::class,
            'status' => AccountStatus::class,
            'balance_cents' => 'integer',
            'low_balance_notified' => 'boolean',
            'opened_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function sentTransfers(): HasMany
    {
        return $this->hasMany(Transfer::class, 'from_account_id');
    }

    public function receivedTransfers(): HasMany
    {
        return $this->hasMany(Transfer::class, 'to_account_id');
    }

    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    public function isActive(): bool
    {
        return $this->status === AccountStatus::Active;
    }
}
