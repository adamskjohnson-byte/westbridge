<?php

namespace App\Exceptions\Bank;

class InsufficientFundsException extends BankException
{
    public function __construct()
    {
        parent::__construct('The source account has insufficient funds.');
    }

    public function machineCode(): string
    {
        return 'insufficient_funds';
    }
}
