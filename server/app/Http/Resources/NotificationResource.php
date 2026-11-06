<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = $this->data ?? [];

        return [
            'id' => $this->id,
            'type' => $data['type'] ?? 'unknown',
            'params' => $data['params'] ?? [],
            'read_at' => $this->read_at?->utc()->toISOString(),
            'created_at' => $this->created_at?->utc()->toISOString(),
        ];
    }
}