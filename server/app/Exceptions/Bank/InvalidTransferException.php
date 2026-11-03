<?php

namespace App\Exceptions\Bank;

class InvalidTransferException extends BankException
{
    public function __construct(string $message, private readonly string $codeValue = 'invalid_transfer')
    {
        parent::__construct($message);
    }

    public function machineCode(): string
    {
        return $this->codeValue;
    }
}
