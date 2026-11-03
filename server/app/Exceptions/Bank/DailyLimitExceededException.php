<?php

namespace App\Exceptions\Bank;

class DailyLimitExceededException extends BankException
{
    public function __construct()
    {
        parent::__construct('The daily outgoing transfer limit would be exceeded.');
    }

    public function machineCode(): string
    {
        return 'daily_limit_exceeded';
    }
}
