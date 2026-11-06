<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoginChallenge extends Model
{
    use HasUlids;

    public $incrementing = false;

    protected $keyType = 'string';

    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'purpose', 'code_hash', 'attempts', 'expires_at', 'consumed_at', 'resend_count', 'last_sent_at', 'ip_address', 'created_at'];

    protected function casts(): array
    {
        return ['attempts' => 'integer', 'resend_count' => 'integer', 'expires_at' => 'immutable_datetime', 'consumed_at' => 'immutable_datetime', 'last_sent_at' => 'immutable_datetime', 'created_at' => 'immutable_datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}