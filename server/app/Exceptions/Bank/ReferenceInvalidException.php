<?php

namespace App\Exceptions\Bank;

class ReferenceInvalidException extends BankException
{
    public function __construct()
    {
        parent::__construct('The bill reference is invalid for this biller.');
    }

    public function machineCode(): string
    {
        return 'reference_invalid';
    }
}
