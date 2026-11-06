<?php

namespace App\Http\Resources;

use App\Services\BeneficiaryService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BeneficiaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'nickname' => $this->nickname,
            'number_masked' => BeneficiaryService::maskAccountNumber($this->account_number),
            'created_at' => $this->created_at?->utc()->toISOString(),
        ];
    }
}
