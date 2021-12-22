import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        address mintto
    ) public ERC20(name, symbol) {
        _mint(mintto, 1000000 ether);
    }
}
