import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TodoApp } from "../target/types/todo_app";
import { expect } from "chai";

describe("todo-app", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.todoApp as Program<TodoApp>;
  const provider = anchor.getProvider();

  // Test accounts
  let counterKeypair: anchor.web3.Keypair;
  let todoKeypair: anchor.web3.Keypair;
  let userKeypair: anchor.web3.Keypair;

  before(async () => {
    // Generate keypairs for testing
    counterKeypair = anchor.web3.Keypair.generate();
    userKeypair = anchor.web3.Keypair.generate();

    // Airdrop SOL to user for testing
    const signature = await provider.connection.requestAirdrop(
      userKeypair.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
  });

  it("Initializes the counter", async () => {
    await program.methods
      .initialize()
      .accounts({
        counter: counterKeypair.publicKey,
        user: userKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([counterKeypair, userKeypair])
      .rpc();

    // Fetch the counter account and verify it was initialized correctly
    const counterAccount = await program.account.counter.fetch(counterKeypair.publicKey);
    expect(counterAccount.count.toNumber()).to.equal(0);
  });

  it("Creates a todo", async () => {
    todoKeypair = anchor.web3.Keypair.generate();
    
    const title = "My First Todo";
    const description = "This is a test todo item";
    const startTime = Math.floor(Date.now() / 1000); // Current timestamp
    const endTime = startTime + 86400; // 24 hours later

    await program.methods
      .createTodo(title, description, new anchor.BN(startTime), new anchor.BN(endTime))
      .accounts({
        todo: todoKeypair.publicKey,
        counter: counterKeypair.publicKey,
        user: userKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([todoKeypair, userKeypair])
      .rpc();

    // Fetch and verify the todo account
    const todoAccount = await program.account.todo.fetch(todoKeypair.publicKey);
    expect(todoAccount.id.toNumber()).to.equal(0);
    expect(todoAccount.title).to.equal(title);
    expect(todoAccount.description).to.equal(description);
    expect(todoAccount.completed).to.equal(false);
    expect(todoAccount.startedAt.toNumber()).to.equal(startTime);
    expect(todoAccount.completedAt.toNumber()).to.equal(endTime);
    expect(todoAccount.owner.toString()).to.equal(userKeypair.publicKey.toString());

    // Verify counter was incremented
    const counterAccount = await program.account.counter.fetch(counterKeypair.publicKey);
    expect(counterAccount.count.toNumber()).to.equal(1);
  });

  it("Creates multiple todos with auto-incrementing IDs", async () => {
    const todo2Keypair = anchor.web3.Keypair.generate();
    const todo3Keypair = anchor.web3.Keypair.generate();

    // Create second todo
    await program.methods
      .createTodo("Second Todo", "Another test", new anchor.BN(123456), new anchor.BN(234567))
      .accounts({
        todo: todo2Keypair.publicKey,
        counter: counterKeypair.publicKey,
        user: userKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([todo2Keypair, userKeypair])
      .rpc();

    // Create third todo
    await program.methods
      .createTodo("Third Todo", "Yet another test", new anchor.BN(345678), new anchor.BN(456789))
      .accounts({
        todo: todo3Keypair.publicKey,
        counter: counterKeypair.publicKey,
        user: userKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([todo3Keypair, userKeypair])
      .rpc();

    // Verify IDs are auto-incrementing
    const todo2Account = await program.account.todo.fetch(todo2Keypair.publicKey);
    const todo3Account = await program.account.todo.fetch(todo3Keypair.publicKey);
    
    expect(todo2Account.id.toNumber()).to.equal(1);
    expect(todo3Account.id.toNumber()).to.equal(2);

    // Verify counter is now 3
    const counterAccount = await program.account.counter.fetch(counterKeypair.publicKey);
    expect(counterAccount.count.toNumber()).to.equal(3);
  });

  it("Edits a todo", async () => {
    const newTitle = "Updated Todo Title";
    const newDescription = "Updated description";
    const newStartTime = 999999;
    const newEndTime = 888888;

    await program.methods
      .editTodo(newTitle, newDescription, true, new anchor.BN(newStartTime), new anchor.BN(newEndTime))
      .accounts({
        todo: todoKeypair.publicKey,
        user: userKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    // Fetch and verify the updated todo
    const todoAccount = await program.account.todo.fetch(todoKeypair.publicKey);
    expect(todoAccount.title).to.equal(newTitle);
    expect(todoAccount.description).to.equal(newDescription);
    expect(todoAccount.completed).to.equal(true);
    expect(todoAccount.startedAt.toNumber()).to.equal(newStartTime);
    expect(todoAccount.completedAt.toNumber()).to.equal(newEndTime);
    expect(todoAccount.id.toNumber()).to.equal(0); // ID should remain unchanged
  });

  it("Partially edits a todo (only some fields)", async () => {
    // Only update title and completed status
    await program.methods
      .editTodo("Partially Updated", null, false, null, null)
      .accounts({
        todo: todoKeypair.publicKey,
        user: userKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    // Fetch and verify only specified fields were updated
    const todoAccount = await program.account.todo.fetch(todoKeypair.publicKey);
    expect(todoAccount.title).to.equal("Partially Updated");
    expect(todoAccount.completed).to.equal(false);
    // These should remain unchanged from previous test
    expect(todoAccount.description).to.equal("Updated description");
    expect(todoAccount.startedAt.toNumber()).to.equal(999999);
    expect(todoAccount.completedAt.toNumber()).to.equal(888888);
  });

  it("Fails to edit todo with wrong owner", async () => {
    const wrongUserKeypair = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to wrong user
    const signature = await provider.connection.requestAirdrop(
      wrongUserKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    try {
      await program.methods
        .editTodo("Should Fail", null, null, null, null)
        .accounts({
          todo: todoKeypair.publicKey,
          user: wrongUserKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wrongUserKeypair])
        .rpc();
      
      // If we reach here, the test should fail
      expect.fail("Expected transaction to fail");
    } catch (error) {
      // Expected to fail due to address constraint
      expect(error).to.exist;
    }
  });

  it("Deletes a todo", async () => {
    const userBalanceBefore = await provider.connection.getBalance(userKeypair.publicKey);

    await program.methods
      .deleteTodo()
      .accounts({
        todo: todoKeypair.publicKey,
        user: userKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    // Verify the account was closed
    try {
      await program.account.todo.fetch(todoKeypair.publicKey);
      expect.fail("Expected account to be closed");
    } catch (error) {
      // Expected - account should be closed
      expect(error.message).to.include("Account does not exist");
    }

    // Verify user received the lamports back
    const userBalanceAfter = await provider.connection.getBalance(userKeypair.publicKey);
    expect(userBalanceAfter).to.be.greaterThan(userBalanceBefore);
  });

  it("Fails to delete todo with wrong owner", async () => {
    // Create a new todo first
    const newTodoKeypair = anchor.web3.Keypair.generate();
    await program.methods
      .createTodo("Todo to Delete", "This will be deleted by wrong user", new anchor.BN(111111), new anchor.BN(222222))
      .accounts({
        todo: newTodoKeypair.publicKey,
        counter: counterKeypair.publicKey,
        user: userKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([newTodoKeypair, userKeypair])
      .rpc();

    // Try to delete with wrong user
    const wrongUserKeypair = anchor.web3.Keypair.generate();
    const signature = await provider.connection.requestAirdrop(
      wrongUserKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    try {
      await program.methods
        .deleteTodo()
        .accounts({
          todo: newTodoKeypair.publicKey,
          user: wrongUserKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wrongUserKeypair])
        .rpc();
      
      expect.fail("Expected transaction to fail");
    } catch (error) {
      // Expected to fail due to address constraint
      expect(error).to.exist;
    }
  });
});
