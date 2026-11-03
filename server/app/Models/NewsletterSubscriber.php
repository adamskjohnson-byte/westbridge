<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NewsletterSubscriber extends Model
{
    use HasFactory;

    protected $fillable = [
        'email',
        'unsubscribe_token',
        'confirmed_at',
        'subscribed_at',
    ];

    protected function casts(): array
    {
        return [
            'confirmed_at' => 'immutable_datetime',
            'subscribed_at' => 'immutable_datetime',
        ];
    }
}
