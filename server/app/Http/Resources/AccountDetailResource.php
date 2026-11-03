<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class AccountDetailResource extends AccountResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'account_number' => $this->account_number,
        ];
    }
}
