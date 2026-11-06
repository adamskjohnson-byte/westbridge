<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSetting extends Model
{
    protected $fillable = ['user_id', 'locale', 'theme', 'email_activity', 'low_balance_threshold_cents'];
    protected function casts(): array { return ['email_activity' => 'boolean', 'low_balance_threshold_cents' => 'integer']; }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}