<?php

namespace App\Models;

use App\Enums\TransactionCategory;
use App\Enums\TransactionDirection;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class Transaction extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $fillable = [
        'account_id',
        'transfer_id',
        'direction',
        'amount_cents',
        'balance_after_cents',
        'category',
        'description',
        'counterparty_name',
        'reference',
        'posted_at',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'direction' => TransactionDirection::class,
            'category' => TransactionCategory::class,
            'amount_cents' => 'integer',
            'balance_after_cents' => 'integer',
            'posted_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
        ];
    }

    public function save(array $options = []): bool
    {
        if ($this->exists) {
            throw new LogicException('Ledger transactions are immutable.');
        }

        return parent::save($options);
    }

    public function update(array $attributes = [], array $options = []): bool
    {
        if ($this->exists) {
            throw new LogicException('Ledger transactions are immutable.');
        }

        return parent::update($attributes, $options);
    }

    public function delete(): ?bool
    {
        if ($this->exists) {
            throw new LogicException('Ledger transactions are immutable.');
        }

        return parent::delete();
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(Transfer::class);
    }

    public function scopeForAccount(Builder $query, Account|int $account): Builder
    {
        return $query->where('account_id', $account instanceof Account ? $account->getKey() : $account);
    }

    public function scopeBetweenDates(Builder $query, DateTimeInterface|string $start, DateTimeInterface|string $end): Builder
    {
        return $query->whereBetween('posted_at', [$start, $end]);
    }
}
