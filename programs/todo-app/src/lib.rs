use anchor_lang::prelude::*;

declare_id!("FjqsHAYqggLPJhd142fYKHEMPJCqrzmVcSwDkPzsC6rP");

pub const ANCHOR_DISCRIMINATOR: usize = 8;

#[program]
pub mod todo_app {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        Ok(())
    }

    pub fn create_todo(ctx: Context<CreateTodo>, title: String, description: String, start: u64, end: u64) -> Result<()> {
        let todo = &mut ctx.accounts.todo;
        let counter = &mut ctx.accounts.counter;
        
        // Auto-generate ID from counter
        todo.id = counter.count;
        counter.count += 1;
        
        todo.title = title;
        todo.description = description;
        todo.completed = false;
        todo.started_at = start;
        todo.completed_at = end;
        todo.owner = ctx.accounts.user.key();
        Ok(())
    }

    pub fn edit_todo(ctx: Context<EditTodo>, title: Option<String>, description: Option<String>, completed: Option<bool>, started_at: Option<u64>, completed_at: Option<u64>) -> Result<()> {
        let todo = &mut ctx.accounts.todo;

        if let Some(t) = title {
            todo.title = t;
        }
        if let Some(d) = description {
            todo.description = d;
        }
        if let Some(c) = completed {
            todo.completed = c;
        }
        if let Some(s) = started_at {
            todo.started_at = s;
        }
        if let Some(e) = completed_at {
            todo.completed_at = e;
        }

        Ok(())
    }

    pub fn delete_todo(_ctx: Context<DeleteTodo>) -> Result<()> {
        // The account will be closed and the lamports sent to the user
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateTodo<'info> {
    #[account(
        init, 
        payer = user,
        space = ANCHOR_DISCRIMINATOR + Todo::INIT_SPACE,
    )]
    pub todo: Account<'info, Todo>,
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EditTodo<'info> {
    #[account(mut)]
    pub todo: Account<'info, Todo>,
    #[account(address = todo.owner)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}



#[derive(Accounts)]
pub struct DeleteTodo<'info> {
    #[account(mut, close = user)]
    pub todo: Account<'info, Todo>,
    #[account(mut, address = todo.owner)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[account]
#[derive(InitSpace)]
pub struct Todo {
    id: u64,
    #[max_len(100)]
    title: String,
    #[max_len(500)] 
    description: String,
    completed: bool,
    started_at: u64,
    completed_at: u64,
    owner: Pubkey,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = ANCHOR_DISCRIMINATOR + Counter::INIT_SPACE
    )]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub count: u64,
}  
