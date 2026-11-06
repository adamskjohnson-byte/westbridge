<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'email' => $this->email,
            'role' => $this->role->value,
            'email_verified' => $this->hasVerifiedEmail(),
            'two_factor_enabled' => $this->two_factor_enabled_at !== null,
            'created_at' => $this->created_at,
        ];
    }
}
