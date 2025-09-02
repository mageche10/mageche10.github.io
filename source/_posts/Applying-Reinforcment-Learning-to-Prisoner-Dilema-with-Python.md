---
title: "Applying Reinforcement Learning to Prisoner's Dilemma with Python"
date: 2025-09-02 09:10:32
tags: [Machine Learning, Game Theory]
description: Learn how a Q-Learning agent tackles the Iterated Prisoner’s Dilemma. Explore strategies, training process, and key insights from reinforcement learning.
---

## Introduction

**Reinforcement Learning** (RL) is a subfield of **machine learning** in which  the agent learns through interaction with environments and then subsequently gains feedback from the environment in the form of **reward**. Unlike supervised learning, there are **no correct action examples provided** to the model. Therefore, an RL agent or learner must find methods to appropriately balance short-term rewards against long-term ramifications, discover what methods are working amongst various opponents, and consider which ones to cooperate with or defect against.

In this article, we will produce and train a simple **Q-Learning agent** to participate in the iterated Prisoner's Dilemma. Additionally, we will discuss what the environment looks like, the learning process, and how the agent performs against some common strategies, namely Tit-for-Tat, Always Cooperate, or **Always Defect**. Finally, we will discuss what the agent learns, and how it performs against traditional strategies.


### What is Reinforcement Learning

[**Reinforcement learning**](https://en.wikipedia.org/wiki/Reinforcement_learning) (RL) is a subfield of [machine learning](https://en.wikipedia.org/wiki/Machine_learning) where an agent learns to make optimal decisions and achieve goals in a complex and uncertain environment through trial and error. RL can be applied in situations from playing video games and board games to making business decisions like pricing. RL is divided into two main parts:
1. First, we train the model using an RL algorithm. Here I will use [**Q-Learning**](https://en.wikipedia.org/wiki/Q-learning) for its simplicity and ease of implementation.
2. Secondly, we use the model to make real decisions and evaluate the results. If required, we adjust the model's parameters and retrain it. 

### Prisoner Dilemma

The [**prisoner's dilemma**](https://en.wikipedia.org/wiki/Prisoner%27s_dilemma) is a classic problem in [game theory](https://en.wikipedia.org/wiki/Game_theory). The scenario involves two prisoners accused of a crime and interrogated separately. Each prisoner has two options: betray the other (**defect**) or remain silent (**cooperate**). If both remain silent, they receive a light sentence (2 years, for example). If only one betrays, the betrayer goes free while the other gets a heavy punishment (10 years). If both betray, they both receive a moderate punishment (5 years).

From a rational perspective, the best option seems to be defection, as it minimizes the worst possible outcome. However, when both choose this self-interested path, they end up worse off than if they had trusted each other. In our case, we will play a slightly different version of the game. Instead of making just one decision, we will play 200 rounds in each game, and instead of punishments, the players will receive points. The rewards are the following:

- If both defect: they each win **1 point**.
- If one defects and the other cooperates: the defector wins **5 points** and the other one **0 points**.
- If both cooperate: they each win **3 points**.

Now, the decisions are not independent from previous ones, so the best option may not always be to defect.

In [Axelrod’s well-known tournament](https://cs.stanford.edu/people/eroberts/courses/soco/projects/1998-99/game-theory/axelrod.html) of repeated Prisoner’s Dilemmas, the strategy called **Tit for Tat (TFT)** turned out to be the most effective. The idea is very simple: start by cooperating, and then just repeat what the other player did in the previous round. This makes it a good strategy because it is *nice* (it starts with cooperation), *retaliatory* (it punishes defection), *forgiving* (it returns to cooperation if the opponent does), and *clear* (its behavior is easy to understand).

## Building the environment

When using RL, the first step is to **build an environment** the agent can interact with; it will be trained on top of that. We start defining all the possible states of the game. Here, we need to find a balance between having a lot of information, but not so much that the model becomes too complex and doesn't train well. We can start by making the agent remember the last five moves.

```python
ACTIONS = ['C', 'D']  # 0, 1
NUM_ACTIONS = 2

MEMORY = 5
PLAYS = product(ACTIONS, ACTIONS)
STATES = list(product(PLAYS, repeat=MEMORY))
STATES_TO_IDX = {state: i for i, state in enumerate(STATES)}
NUM_STATES = len(STATES)
```

Then we define the rewards and other helper functions:

```python
def payoff(action_agent, action_opponent):
    rewards_matrix = {
        ('C', 'C'): (3, 3),
        ('C', 'D'): (0, 5),
        ('D', 'C'): (5, 0),
        ('D', 'D'): (1, 1),
    }
    reward_agent, reward_opponent = rewards_matrix[(action_agent, action_opponent)]
    return reward_agent, reward_opponent

def update_state(state_history, agent_action, opponent_action):
    new_history = state_history[1:] + [(agent_action, opponent_action)]
    return new_history

def selectOpponent(rng):
    opponents_list = [tit_for_tat, always_defect, always_cooperate]
    return opponents_list[int(rng.integers(len(opponents_list)))]
```

We will also define some opponent policies:

```python
def random_opponent(last_opponent, last_agent, rng):
    return 'C' if rng.random() < 0.5 else 'D'

def tit_for_tat(last_opponent, last_agent, rng):
    return 'C' if last_opponent is None else last_agent

def always_defect(last_opponent, last_agent, rng):
    return 'D'

def always_cooperate(last_opponent, last_agent, rng):
    return 'C'
```

> Here I have only included some basic strategies for the game. There are other, more complex ones that could be implemented to see how the agent reacts.

## Training the agent

There are many reinforcement learning methods available. In this case, I have chosen Q-Learning because it is simple and works well in environments where the agent can explore repeatedly. Its use of a Q-Table makes it easy to understand and implement, while still being powerful enough to learn effective strategies.

### Q-Learning algorithm

**Q-Learning** is a type of RL algorithm that helps an agent learn how to make decisions by interacting with an environment. The agent tries different actions in different situations and receives rewards or penalties depending on the results. Over time, it builds a **Q-Table** which stores the expected value (or *quality*) of taking a certain action in a certain state. The goal is to learn which actions bring the most **long-term reward**, not just the immediate benefit.

The algorithm follows a simple idea: update the value of each action step by step based on experience. It balances two things: **exploration** (trying new actions to discover their rewards) and **exploitation** (choosing the best action based on what it already knows). By repeating this process many times, the agent learns an **optimal policy**, which is basically a set of rules telling it what to do in every situation to maximize total rewards.

> Q-Table is basically a matrix where, for each state (row), each action (column) has an expected reward value. The agent will choose the action corresponding to the column with the highest value in that row.

When training the model, the algorithm updates the matrix value after taking a decision based on the reward received. The following formula is used to update the Q-value for a **state-action** pair:

$$ Q(s, a) = (1-\alpha)*Q(s, a) + \alpha \left[ R + \gamma * \max Q (s', a') \right]$$

Where:
 - \\(\alpha\\) is the **learning rate**, controls how much new information overrides old values.
 - \\(\gamma\\) is the **discount factor**, represents the importance of future rewards.
 - \\( R\\) is the **immediate reward**.
 - \\(\max Q(s', a')\\) is the **maximum Q-value** and represents the best possible reward achievable from that state.

We also use an *ε-greedy* policy to balance exploration and exploitation. With probability \\(\varepsilon\\), the agent chooses a random action to explore new possibilities, and with probability \\(1-\varepsilon\\), it chooses the action with the highest **Q-value**. At the beginning of training, \\(\varepsilon\\) is set high so that the agent explores a lot. As training goes on, \\(\varepsilon\\) is gradually reduced (**epsilon decay**), which means the agent relies more on what it has already learned.

This is the code I use to train the agent:

```python
def chose_action(q_table, state, epsilon, rng):
    if rng.random() < epsilon:
        return int(rng.integers(NUM_ACTIONS))
    return int(np.argmax(q_table[state]))

def train_q_learning(rng, games=3000, rounds=200):
    alpha = 0.05
    gamma = 0.97
    epsilon = 0.3
    epsilon_decay = 0.995
    epsilon_min = 0.05

    q_table = np.zeros((NUM_STATES, NUM_ACTIONS))
    rewards_history = []

    for game in range(games):
        state_history = [('C', 'C')]*MEMORY
        state_idx = STATES_TO_IDX[tuple(state_history)]
        last_opponent = None
        last_agent = None
        game_reward = 0
        opponent_policy = selectOpponent(rng)

        for r in range(rounds):
            agent_action_idx = chose_action(q_table, state_idx, epsilon, rng)
            agent_action = ACTIONS[agent_action_idx]

            opponent_action = opponent_policy(last_opponent, last_agent, rng)

            rewards = payoff(agent_action, opponent_action)
            agent_reward = rewards[0]
            game_reward = game_reward + agent_reward

            next_state_history = update_state(state_history, agent_action, opponent_action)
            next_state_idx = STATES_TO_IDX[tuple(next_state_history)]

            old_value = q_table[state_idx, agent_action_idx]
            new_value = (1 - alpha) * old_value + alpha * (agent_reward + gamma * np.max(q_table[next_state_idx]))
            q_table[state_idx, agent_action_idx] = new_value

            last_agent = agent_action
            last_opponent = opponent_action
            state_history = next_state_history
            state_idx = next_state_idx

        rewards_history.append(game_reward)
        epsilon = max(epsilon_min, epsilon * epsilon_decay)

    return q_table, rewards_history
```

You can try to change the **hyperparameter** values to see if you get a better result.

## Playing the game

Now it's time to see how the model plays a real game. We first define the function to play a game:

```python
def evaluation(q_table, opponent_policy, rounds=200, seed=0):
    rng = np.random.default_rng(seed)
    state_history = [('C', 'C')] * MEMORY
    state_idx = STATES_TO_IDX[tuple(state_history)]
    last_opponent = None
    last_agent = None
    game_reward = 0

    for r in range(rounds):
        agent_action_index = int(np.argmax(q_table[state_idx]))
        agent_action = ACTIONS[agent_action_index]
        opponent_action = opponent_policy(last_opponent, last_agent, rng)

        rewards = payoff(agent_action, opponent_action)
        agent_reward = rewards[0]
        game_reward += agent_reward

        state_history = update_state(state_history, agent_action, opponent_action)
        state_idx = STATES_TO_IDX[tuple(state_history)]
        last_agent = agent_action
        last_opponent = opponent_action

    return game_reward/rounds
```

For each game, we will obtain an average score for each round. Then we make the agent play against our policies: 

```python
avg_TfT = evaluation(Q, tit_for_tat)
avg_CC = evaluation(Q, always_cooperate)
avg_DD = evaluation(Q, always_defect)
avg_RND = evaluation(Q, random_opponent)
```

These are the results:
- Average reward against Tit for Tat: 2.83
- Average reward against always Cooperate: 4.97
- Average reward against always Defect: 0.99
- Average reward against random: 1.44

We can see that the model achieves fairly solid scores. We can also see that the model:
- **Takes advantage** of overly *nice* strategies.
- **Protects** itself from very uncooperative strategies.
- **Cooperates** with *nice* strategies that are *retaliatory*.

Furthermore, observing the moves in each game reveals that the agent always **begins by defecting** to detect overly kind strategies. While it does not always obtain the best possible score, it is versatile and can adapt well to different situations. In the future, it would be interesting to train the model with other strategies to see the results.

## Conclusions

Beyond the social, political, or economic implications of the prisoner’s dilemma and iterative forms of it, today we have completed the project of **creating a reinforcement learning agent from scratch**. By training a Q-Learning agent and testing it against classic strategies, we see how reinforcement learning can **adapt to various opponents and environments**. An agent that learns through reinforcement learning (the Q-Learning agent) displays behavior that maximizes its own reward as well as behavior adaptation that recognizes the behavior of other agents, recognizing times when it cooperates, defends, or exploits. This **flexibility** is one of the strengths of RL approaches.

In addition, the experiment serves to show the complexity of choosing strategies that involved a subtle **balance of cooperation and competition**. Although the agent may not score the highest possible score, its ability to learn from experience and malleability makes it a major advantage. The underlying points of the experiment could be extended further into **economics, politics, more complex social interactions, intelligent robotic systems, or artificial intelligence** contexts.

For more information about the Prisoner's Dilema, check Axelrod's book [*The Evolution of Cooperation*](https://en.wikipedia.org/wiki/The_Evolution_of_Cooperation). See also my other post about Machine Learning: [*Building a RAG AI with Ollama*](/2025/Building-a-RAG-AI-with-Ollama-and-LangChain-PDF-Answer-AI/).


