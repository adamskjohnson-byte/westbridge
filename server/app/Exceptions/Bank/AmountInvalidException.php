<?php

namespace App\Exceptions\Bank;

class AmountInvalidException extends BankException
{
    public function __construct()
    {
        parent::__construct('The amount is outside the allowed range.');
    }

    public function machineCode(): string
    {
        return 'amount_invalid';
    }
}
