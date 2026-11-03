<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DashboardSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'currency' => $this->resource['currency'],
            'total_balance_cents' => $this->resource['total_balance_cents'],
            'accounts' => AccountResource::collection($this->resource['accounts'])->resolve($request),
            'month' => $this->resource['month'],
            'series' => $this->resource['series'],
            'spending_by_category' => $this->resource['spending_by_category'],
            'recent' => TransactionResource::collection($this->resource['recent'])->resolve($request),
        ];
    }
}
