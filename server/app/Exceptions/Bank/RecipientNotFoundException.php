<?php

namespace App\Exceptions\Bank;

class RecipientNotFoundException extends BankException
{
    public function __construct()
    {
        parent::__construct('The recipient could not be found.');
    }

    public function machineCode(): string
    {
        return 'recipient_not_found';
    }
}
