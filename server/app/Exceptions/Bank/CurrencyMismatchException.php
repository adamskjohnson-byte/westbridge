<?php

namespace App\Exceptions\Bank;

class CurrencyMismatchException extends BankException
{
    public function __construct()
    {
        parent::__construct('Both accounts must use the same currency.');
    }

    public function machineCode(): string
    {
        return 'currency_mismatch';
    }
}
