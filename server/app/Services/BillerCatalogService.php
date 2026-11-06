<?php

namespace App\Services;

use App\Exceptions\Bank\BillerNotFoundException;

class BillerCatalogService
{
    public function all(): array
    {
        return array_map(static function (array $biller): array {
            unset($biller['reference_pattern']);

            return $biller;
        }, config('bank.billers', []));
    }

    public function find(string $code): array
    {
        foreach (config('bank.billers', []) as $biller) {
            if ($biller['code'] === $code) {
                return $biller;
            }
        }

        throw new BillerNotFoundException;
    }
}
