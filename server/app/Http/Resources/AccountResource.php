<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'nickname' => $this->nickname,
            'currency' => $this->currency,
            'balance_cents' => $this->balance_cents,
            'status' => $this->status->value,
            'number_masked' => '•••• '.substr($this->account_number, -4),
            'opened_at' => $this->opened_at->utc()->toISOString(),
        ];
    }
}
