#!/usr/bin/env python3
"""
配送ルート最適化問題（Vehicle Routing Problem, VRP）
複数の配送車を使って、複数の顧客への配送を最適化する問題

問題設定：
- 1つの配送センターから複数の顧客への配送
- 各配送車には容量制限がある
- 各顧客には配送量の要求がある
- 総配送距離を最小化する

この例では、PuLPを使って混合整数計画問題として定式化
"""

import pulp
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Circle
import math

def create_delivery_problem():
    """
    配送ルート最適化問題を定式化
    """
    # 問題のインスタンスを作成（最小化問題）
    prob = pulp.LpProblem("DeliveryRouteOptimization", pulp.LpMinimize)
    
    # データの定義
    # 配送センター（0）と顧客（1-6）の座標
    locations = {
        0: (0, 0),    # 配送センター
        1: (2, 3),    # 顧客1
        2: (4, 1),    # 顧客2
        3: (1, 5),    # 顧客3
        4: (5, 4),    # 顧客4
        5: (3, 6),    # 顧客5
        6: (6, 2)     # 顧客6
    }
    
    # 各顧客の配送量要求
    demands = {
        0: 0,    # 配送センター
        1: 10,   # 顧客1
        2: 15,   # 顧客2
        3: 8,    # 顧客3
        4: 12,   # 顧客4
        5: 6,    # 顧客5
        6: 9     # 顧客6
    }
    
    # 配送車の容量
    vehicle_capacity = 25
    
    # 配送車の数
    num_vehicles = 3
    
    # 顧客の集合（配送センターを除く）
    customers = list(range(1, len(locations)))
    
    # 距離行列の計算
    def calculate_distance(i, j):
        x1, y1 = locations[i]
        x2, y2 = locations[j]
        return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
    
    distances = {}
    for i in range(len(locations)):
        for j in range(len(locations)):
            distances[(i, j)] = calculate_distance(i, j)
    
    # 変数の定義
    # x[i][j][k]: 配送車kが地点iから地点jへ移動するかどうか（バイナリ変数）
    x = {}
    for i in range(len(locations)):
        for j in range(len(locations)):
            for k in range(num_vehicles):
                if i != j:  # 同じ地点から同じ地点への移動は除外
                    x[(i, j, k)] = pulp.LpVariable(f"x_{i}_{j}_{k}", cat='Binary')
    
    # u[i][k]: 配送車kが地点iを訪問する順序（連続変数、MTZ制約用）
    u = {}
    for i in customers:
        for k in range(num_vehicles):
            u[(i, k)] = pulp.LpVariable(f"u_{i}_{k}", lowBound=0, upBound=len(customers), cat='Continuous')
    
    # 目的関数：総配送距離の最小化
    prob += pulp.lpSum([distances[(i, j)] * x[(i, j, k)] 
                       for i in range(len(locations)) 
                       for j in range(len(locations)) 
                       for k in range(num_vehicles) 
                       if i != j])
    
    # 制約条件1: 各顧客は必ず1台の配送車によって訪問される
    for j in customers:
        prob += pulp.lpSum([x[(i, j, k)] 
                           for i in range(len(locations)) 
                           for k in range(num_vehicles) 
                           if i != j]) == 1
    
    # 制約条件2: 各配送車は配送センターから出発し、配送センターに戻る
    for k in range(num_vehicles):
        # 配送センターからの出発
        prob += pulp.lpSum([x[(0, j, k)] for j in customers]) <= 1
        # 配送センターへの帰還
        prob += pulp.lpSum([x[(i, 0, k)] for i in customers]) <= 1
        # 出発と帰還の整合性
        prob += pulp.lpSum([x[(0, j, k)] for j in customers]) == pulp.lpSum([x[(i, 0, k)] for i in customers])
    
    # 制約条件3: 各地点での流入・流出の整合性
    for k in range(num_vehicles):
        for j in customers:
            prob += pulp.lpSum([x[(i, j, k)] for i in range(len(locations)) if i != j]) == \
                    pulp.lpSum([x[(j, i, k)] for i in range(len(locations)) if i != j])
    
    # 制約条件4: 容量制約
    for k in range(num_vehicles):
        prob += pulp.lpSum([demands[j] * pulp.lpSum([x[(i, j, k)] for i in range(len(locations)) if i != j]) 
                           for j in customers]) <= vehicle_capacity
    
    # 制約条件5: Miller-Tucker-Zemlin (MTZ) 制約（部分巡回路除去）
    for k in range(num_vehicles):
        for i in customers:
            for j in customers:
                if i != j:
                    prob += u[(i, k)] - u[(j, k)] + len(customers) * x[(i, j, k)] <= len(customers) - 1
    
    return prob, x, u, locations, demands, distances, num_vehicles, customers

def solve_delivery_problem():
    """
    配送問題を解いて結果を返す
    """
    prob, x, u, locations, demands, distances, num_vehicles, customers = create_delivery_problem()
    
    # 問題を解く
    prob.solve()
    
    # 結果の取得
    status = pulp.LpStatus[prob.status]
    total_distance = pulp.value(prob.objective)
    
    # 各配送車のルートを抽出
    routes = {}
    for k in range(num_vehicles):
        routes[k] = []
        # 配送センターから開始
        current = 0
        route = [current]
        
        while True:
            next_location = None
            for j in range(len(locations)):
                if j != current and x[(current, j, k)].varValue == 1:
                    next_location = j
                    break
            
            if next_location is None:
                break
            
            route.append(next_location)
            current = next_location
            
            # 無限ループ防止
            if len(route) > len(locations):
                break
        
        routes[k] = route
    
    return {
        'status': status,
        'total_distance': total_distance,
        'routes': routes,
        'locations': locations,
        'demands': demands,
        'distances': distances,
        'num_vehicles': num_vehicles,
        'customers': customers
    }

def visualize_delivery_routes():
    """
    配送ルートを可視化
    """
    result = solve_delivery_problem()
    
    if result['status'] != 'Optimal':
        print(f"最適解が見つかりませんでした。状態: {result['status']}")
        return None
    
    # グラフの作成
    plt.figure(figsize=(12, 10))
    
    # 色の定義
    colors = ['red', 'blue', 'green', 'orange', 'purple']
    
    # 各地点をプロット
    for i, (x, y) in result['locations'].items():
        if i == 0:  # 配送センター
            plt.plot(x, y, 'ks', markersize=15, label='配送センター' if i == 0 else '')
            plt.annotate(f'配送センター', (x, y), xytext=(5, 5), textcoords='offset points', 
                        fontsize=10, fontweight='bold')
        else:  # 顧客
            plt.plot(x, y, 'ko', markersize=10)
            plt.annotate(f'顧客{i}\n需要:{result["demands"][i]}', (x, y), xytext=(5, 5), 
                        textcoords='offset points', fontsize=9)
    
    # 各配送車のルートをプロット
    for k, route in result['routes'].items():
        if len(route) > 1:  # 有効なルートがある場合
            color = colors[k % len(colors)]
            route_x = [result['locations'][i][0] for i in route]
            route_y = [result['locations'][i][1] for i in route]
            
            # ルートを線で結ぶ
            plt.plot(route_x, route_y, color=color, linewidth=2, alpha=0.7, 
                    label=f'配送車{k+1}')
            
            # 矢印を追加
            for i in range(len(route) - 1):
                start = (route_x[i], route_y[i])
                end = (route_x[i+1], route_y[i+1])
                dx = end[0] - start[0]
                dy = end[1] - start[1]
                plt.arrow(start[0], start[1], dx*0.7, dy*0.7, 
                         head_width=0.1, head_length=0.1, fc=color, ec=color, alpha=0.8)
    
    # グラフの設定
    plt.xlim(-1, 7)
    plt.ylim(-1, 7)
    plt.xlabel('X座標', fontsize=12)
    plt.ylabel('Y座標', fontsize=12)
    plt.title('配送ルート最適化問題の解', fontsize=14, fontweight='bold')
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.axis('equal')
    
    return plt

def print_delivery_results():
    """
    配送結果を詳細に表示
    """
    result = solve_delivery_problem()
    
    print("=== 配送ルート最適化問題の解 ===")
    print(f"解の状態: {result['status']}")
    print(f"総配送距離: {result['total_distance']:.2f}")
    print()
    
    # 各配送車のルート詳細
    for k, route in result['routes'].items():
        if len(route) > 1:
            print(f"配送車{k+1}のルート:")
            total_demand = 0
            total_distance = 0
            
            for i in range(len(route)):
                location = route[i]
                if location == 0:
                    print(f"  {i+1}. 配送センター (0, 0)")
                else:
                    demand = result['demands'][location]
                    total_demand += demand
                    x, y = result['locations'][location]
                    print(f"  {i+1}. 顧客{location} ({x}, {y}) - 需要: {demand}")
                
                # 次の地点への距離を計算
                if i < len(route) - 1:
                    next_location = route[i+1]
                    distance = result['distances'][(location, next_location)]
                    total_distance += distance
            
            print(f"  総配送量: {total_demand} (容量制限: 25)")
            print(f"  ルート距離: {total_distance:.2f}")
            print()
        else:
            print(f"配送車{k+1}: 使用されませんでした")
            print()

# メイン実行
if __name__ == "__main__":
    # 問題を解いて結果を表示
    print_delivery_results()
    
    # 可視化
    plt = visualize_delivery_routes()
    if plt:
        plt.tight_layout()
        plt.show()

