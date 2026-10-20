#pragma once
#include "json.hpp"
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <set>
#include <queue>
#include <stack>
#include <limits>
#include <algorithm>
#include <functional>
#include <stdexcept>

using json = nlohmann::json;

struct Edge {
    std::string id;
    std::string from;
    std::string to;
    long long amount; // raw integer (smallest unit)
    long long timestamp; // unix seconds
    std::string asset;
    long long cost; // nonnegative cost for dijkstra (in smallest units or hops)
};

struct Graph {
    std::vector<std::string> nodes;
    std::vector<Edge> edges;
    std::unordered_map<std::string, std::vector<size_t>> out; // node -> edge indices
    std::unordered_map<std::string, std::vector<size_t>> in;
    std::unordered_set<std::string> nodeSet;

    void build() {
        nodeSet.clear();
        out.clear();
        in.clear();
        for (auto &n : nodes) nodeSet.insert(n);
        for (size_t i=0;i<edges.size();++i){
            const Edge &e = edges[i];
            if (nodeSet.find(e.from)==nodeSet.end()) { nodes.push_back(e.from); nodeSet.insert(e.from); }
            if (nodeSet.find(e.to)==nodeSet.end()) { nodes.push_back(e.to); nodeSet.insert(e.to); }
            out[e.from].push_back(i);
            in[e.to].push_back(i);
        }
    }
    bool hasNode(const std::string &n) const { return nodeSet.count(n)>0; }
};

// Algorithms return json
json bfsPath(const Graph &g, const std::string &src, const std::string &dst, int maxHops);
json dijkstraPath(const Graph &g, const std::string &src, const std::string &dst, int maxHops, const std::string &costMetric);
json detectCycles(const Graph &g, int maxCycles, int maxLen);
json stronglyConnectedComponents(const Graph &g);
json degrees(const Graph &g);
json topKActive(const Graph &g, int k);
json neighbors(const Graph &g, const std::string &node, const std::string &direction, int hops, int limit);
json connectedComponents(const Graph &g);