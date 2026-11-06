<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminAuditLogResource extends JsonResource
{
    private function safeMetadata(mixed $value): mixed
    {
        if (is_string($value)) {
            return preg_replace_callback('/(?<!\d)\d{10}(?!\d)/', static fn (array $match): string => '•••• '.substr($match[0], -4), $value);
        }
        if (! is_array($value)) return $value;
        $safe = [];
        foreach ($value as $key => $item) {
            if (preg_match('/password|token|secret|cvv|card_number|account_number|pan/i', (string) $key)) {
                $safe[$key] = '[redacted]';
            } else {
                $safe[$key] = $this->safeMetadata($item);
            }
        }
        return $safe;
    }

    public function toArray(Request $request): array
    {
        $actor = $this->relationLoaded('user') ? $this->user : null;
        return [
            'id' => (int) $this->id,
            'action' => $this->action,
            'actor' => $actor ? ['id' => (int) $actor->id, 'name' => trim($actor->first_name.' '.$actor->last_name), 'email' => $actor->email] : null,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent === null ? null : mb_substr($this->user_agent, 0, 120),
            'metadata' => $this->safeMetadata($this->metadata),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
