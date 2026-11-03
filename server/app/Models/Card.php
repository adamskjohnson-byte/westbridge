<?php

namespace App\Models;

use App\Enums\CardStatus;
use App\Enums\CardType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Card extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'account_id',
        'type',
        'last4',
        'expiry_month',
        'expiry_year',
        'nickname',
        'status',
        'daily_limit_cents',
    ];

    protected function casts(): array
    {
        return [
            'type' => CardType::class,
            'status' => CardStatus::class,
            'expiry_month' => 'integer',
            'expiry_year' => 'integer',
            'daily_limit_cents' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }
}
