<?php

namespace App\Exceptions\Bank;

class BillerNotFoundException extends BankException
{
    public function __construct()
    {
        parent::__construct('The biller could not be found.');
    }

    public function machineCode(): string
    {
        return 'biller_not_found';
    }
}
