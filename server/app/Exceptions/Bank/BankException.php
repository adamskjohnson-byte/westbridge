<?php

namespace App\Exceptions\Bank;

use RuntimeException;

abstract class BankException extends RuntimeException
{
    abstract public function machineCode(): string;
}
