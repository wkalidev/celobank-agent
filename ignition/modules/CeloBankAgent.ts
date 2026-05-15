import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CeloBankAgent", (m) => {
  const celoBankAgent = m.contract("CeloBankAgent");
  return { celoBankAgent };
});