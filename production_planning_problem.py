#!/usr/bin/env python3
"""
生産計画問題（Production Planning Problem）
線形計画問題の代表的な例題

問題設定：
- 複数の製品を複数の期間にわたって生産する
- 各製品には需要予測、生産コスト、在庫コストがある
- 生産能力制限と在庫容量制限がある
- 総コスト（生産コスト + 在庫コスト）を最小化する

この例では、PuLPを使って線形計画問題として定式化
"""

import pulp

def create_production_planning_problem():
    """
    生産計画問題を定式化
    """
    # 問題のインスタンスを作成（最小化問題）
    prob = pulp.LpProblem("ProductionPlanning", pulp.LpMinimize)
    
    # データの定義
    products = ['製品A', '製品B', '製品C']
    periods = [1, 2, 3, 4]  # 4期間
    
    # 需要予測（期間別、製品別）
    demand = {
        ('製品A', 1): 100, ('製品A', 2): 120, ('製品A', 3): 110, ('製品A', 4): 130,
        ('製品B', 1): 80,  ('製品B', 2): 90,  ('製品B', 3): 85,  ('製品B', 4): 95,
        ('製品C', 1): 60,  ('製品C', 2): 70,  ('製品C', 3): 65,  ('製品C', 4): 75
    }
    
    # 生産コスト（製品別）
    production_cost = {
        '製品A': 50,
        '製品B': 40,
        '製品C': 30
    }
    
    # 在庫コスト（製品別）
    inventory_cost = {
        '製品A': 5,
        '製品B': 4,
        '製品C': 3
    }
    
    # 生産能力制限（期間別）
    capacity = {
        1: 300,
        2: 320,
        3: 310,
        4: 330
    }
    
    # 在庫容量制限（製品別）
    storage_capacity = {
        '製品A': 200,
        '製品B': 150,
        '製品C': 100
    }
    
    # 初期在庫
    initial_inventory = {
        '製品A': 50,
        '製品B': 30,
        '製品C': 20
    }
    
    # 変数の定義
    # x[p, t]: 期間tにおける製品pの生産量
    x = {}
    for product in products:
        for period in periods:
            x[(product, period)] = pulp.LpVariable(f"x_{product}_{period}", lowBound=0, cat='Continuous')
    
    # s[p, t]: 期間t終了時の製品pの在庫量
    s = {}
    for product in products:
        for period in periods:
            s[(product, period)] = pulp.LpVariable(f"s_{product}_{period}", lowBound=0, cat='Continuous')
    
    # 目的関数：総コストの最小化
    # 総コスト = 生産コスト + 在庫コスト
    prob += pulp.lpSum([production_cost[product] * x[(product, period)] 
                       for product in products for period in periods]) + \
            pulp.lpSum([inventory_cost[product] * s[(product, period)] 
                       for product in products for period in periods])
    
    # 制約条件1: 需要充足制約
    for product in products:
        for period in periods:
            if period == 1:
                # 第1期間：初期在庫 + 生産量 - 在庫量 = 需要
                prob += initial_inventory[product] + x[(product, period)] - s[(product, period)] == demand[(product, period)]
            else:
                # 第2期間以降：前期末在庫 + 生産量 - 在庫量 = 需要
                prob += s[(product, period-1)] + x[(product, period)] - s[(product, period)] == demand[(product, period)]
    
    # 制約条件2: 生産能力制約
    for period in periods:
        prob += pulp.lpSum([x[(product, period)] for product in products]) <= capacity[period]
    
    # 制約条件3: 在庫容量制約
    for product in products:
        for period in periods:
            prob += s[(product, period)] <= storage_capacity[product]
    
    return prob, x, s, products, periods, demand, production_cost, inventory_cost, capacity, storage_capacity, initial_inventory

def solve_production_planning_problem():
    """
    生産計画問題を解いて結果を返す
    """
    prob, x, s, products, periods, demand, production_cost, inventory_cost, capacity, storage_capacity, initial_inventory = create_production_planning_problem()
    
    # 問題を解く
    prob.solve()
    
    # 結果の取得
    status = pulp.LpStatus[prob.status]
    total_cost = pulp.value(prob.objective)
    
    # 生産量と在庫量を抽出
    production_plan = {}
    inventory_plan = {}
    
    for product in products:
        production_plan[product] = {}
        inventory_plan[product] = {}
        for period in periods:
            production_plan[product][period] = x[(product, period)].varValue
            inventory_plan[product][period] = s[(product, period)].varValue
    
    return {
        'status': status,
        'total_cost': total_cost,
        'production_plan': production_plan,
        'inventory_plan': inventory_plan,
        'products': products,
        'periods': periods,
        'demand': demand,
        'production_cost': production_cost,
        'inventory_cost': inventory_cost,
        'capacity': capacity,
        'storage_capacity': storage_capacity,
        'initial_inventory': initial_inventory
    }

def print_production_results():
    """
    生産計画問題の結果を詳細に表示
    """
    result = solve_production_planning_problem()
    
    print("=== 生産計画問題の解 ===")
    print(f"解の状態: {result['status']}")
    print(f"総コスト: {result['total_cost']:,.0f}円")
    print()
    
    # 期間別の詳細表示
    for period in result['periods']:
        print(f"=== 期間{period} ===")
        print(f"生産能力: {result['capacity'][period]}")
        print()
        
        total_production = 0
        for product in result['products']:
            production = result['production_plan'][product][period]
            inventory = result['inventory_plan'][product][period]
            demand_val = result['demand'][(product, period)]
            total_production += production
            
            print(f"{product}:")
            print(f"  需要: {demand_val}")
            print(f"  生産: {production:.1f}")
            print(f"  在庫: {inventory:.1f}")
            print(f"  生産コスト: {production * result['production_cost'][product]:,.0f}円")
            print(f"  在庫コスト: {inventory * result['inventory_cost'][product]:,.0f}円")
            print()
        
        print(f"期間{period}の総生産量: {total_production:.1f} / {result['capacity'][period]}")
        print("-" * 50)
        print()
    
    # コスト内訳
    print("=== コスト内訳 ===")
    total_production_cost = 0
    total_inventory_cost = 0
    
    for product in result['products']:
        product_production_cost = 0
        product_inventory_cost = 0
        
        for period in result['periods']:
            production = result['production_plan'][product][period]
            inventory = result['inventory_plan'][product][period]
            product_production_cost += production * result['production_cost'][product]
            product_inventory_cost += inventory * result['inventory_cost'][product]
        
        total_production_cost += product_production_cost
        total_inventory_cost += product_inventory_cost
        
        print(f"{product}:")
        print(f"  生産コスト: {product_production_cost:,.0f}円")
        print(f"  在庫コスト: {product_inventory_cost:,.0f}円")
        print()
    
    print(f"総生産コスト: {total_production_cost:,.0f}円")
    print(f"総在庫コスト: {total_inventory_cost:,.0f}円")
    print(f"総コスト: {total_production_cost + total_inventory_cost:,.0f}円")

def print_problem_info():
    """
    問題の詳細情報を表示
    """
    prob, x, s, products, periods, demand, production_cost, inventory_cost, capacity, storage_capacity, initial_inventory = create_production_planning_problem()
    
    print("=== 生産計画問題の設定 ===")
    print(f"製品数: {len(products)}")
    print(f"期間数: {len(periods)}")
    print()
    
    print("製品情報:")
    for product in products:
        print(f"  {product}: 生産コスト={production_cost[product]}円, 在庫コスト={inventory_cost[product]}円, 在庫容量={storage_capacity[product]}")
    print()
    
    print("期間別生産能力:")
    for period in periods:
        print(f"  期間{period}: {capacity[period]}")
    print()
    
    print("初期在庫:")
    for product in products:
        print(f"  {product}: {initial_inventory[product]}")
    print()
    
    print("需要予測:")
    print("期間", end="")
    for product in products:
        print(f"  {product}", end="")
    print()
    
    for period in periods:
        print(f"  {period}", end="")
        for product in products:
            print(f"    {demand[(product, period)]}", end="")
        print()
    print()

# メイン実行
if __name__ == "__main__":
    # 問題の詳細情報を表示
    print_problem_info()
    
    # 問題を解いて結果を表示
    print_production_results()

