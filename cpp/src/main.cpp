#include "graph.h"
#include <iostream>
#include <sstream>

static Graph loadGraph(const json &input){
    Graph g;
    if (input.contains("nodes")) for (auto &n : input["nodes"]) g.nodes.push_back(n.get<std::string>());
    if (input.contains("edges")) for (auto &e : input["edges"]){
        Edge ed;
        ed.id = e.value("id", std::string(""));
        ed.from = e["from"].get<std::string>();
        ed.to = e["to"].get<std::string>();
        ed.amount = e.value("amount", 0LL);
        ed.timestamp = e.value("timestamp", 0LL);
        ed.asset = e.value("asset", std::string(""));
        ed.cost = e.value("cost", 0LL);
        g.edges.push_back(ed);
    }
    g.build();
    return g;
}

int main(int argc, char** argv){
    std::string cmd = argc>1 ? argv[1] : "";
    std::ostringstream ss; ss << std::cin.rdbuf();
    std::string inputStr = ss.str();
    json input = inputStr.empty() ? json::object() : json::parse(inputStr);
    try {
        if (cmd=="bfs") {
            Graph g=loadGraph(input);
            std::string src=input.value("source",""), dst=input.value("destination","");
            int maxHops=input.value("maxHops",10);
            std::cout << bfsPath(g,src,dst,maxHops).dump() << std::endl;
        } else if (cmd=="dijkstra") {
            Graph g=loadGraph(input);
            std::string src=input.value("source",""), dst=input.value("destination","");
            int maxHops=input.value("maxHops",10);
            std::string metric=input.value("costMetric","cost");
            std::cout << dijkstraPath(g,src,dst,maxHops,metric).dump() << std::endl;
        } else if (cmd=="cycles") {
            Graph g=loadGraph(input);
            int mc=input.value("maxCycles",50), ml=input.value("maxLen",8);
            std::cout << detectCycles(g,mc,ml).dump() << std::endl;
        } else if (cmd=="scc") {
            Graph g=loadGraph(input);
            std::cout << stronglyConnectedComponents(g).dump() << std::endl;
        } else if (cmd=="degrees") {
            Graph g=loadGraph(input);
            std::cout << degrees(g).dump() << std::endl;
        } else if (cmd=="topk") {
            Graph g=loadGraph(input);
            int k=input.value("k",10);
            std::cout << topKActive(g,k).dump() << std::endl;
        } else if (cmd=="neighbors") {
            Graph g=loadGraph(input);
            std::string node=input.value("node",""), dir=input.value("direction","both");
            int hops=input.value("hops",2), limit=input.value("limit",200);
            std::cout << neighbors(g,node,dir,hops,limit).dump() << std::endl;
        } else if (cmd=="components") {
            Graph g=loadGraph(input);
            std::cout << connectedComponents(g).dump() << std::endl;
        } else if (cmd=="bfsTrace") {
            Graph g=loadGraph(input);
            std::string src=input.value("source",""), dst=input.value("destination","");
            int maxHops=input.value("maxHops",10), maxSteps=input.value("maxSteps",300);
            std::cout << bfsTrace(g,src,dst,maxHops,maxSteps).dump() << std::endl;
        } else if (cmd=="dfsTrace") {
            Graph g=loadGraph(input);
            std::string src=input.value("source",""), dst=input.value("destination","");
            int maxHops=input.value("maxHops",10), maxSteps=input.value("maxSteps",300);
            std::cout << dfsTrace(g,src,dst,maxHops,maxSteps).dump() << std::endl;
        } else if (cmd=="dijkstraTrace") {
            Graph g=loadGraph(input);
            std::string src=input.value("source",""), dst=input.value("destination","");
            int maxHops=input.value("maxHops",10);
            std::string metric=input.value("costMetric","cost");
            int maxSteps=input.value("maxSteps",300);
            std::cout << dijkstraTrace(g,src,dst,maxHops,metric,maxSteps).dump() << std::endl;
        } else {
            std::cout << json{{"error","unknown command"}}.dump() << std::endl;
            return 1;
        }
    } catch (const std::exception &e) {
        std::cout << json{{"error",e.what()}}.dump() << std::endl;
        return 1;
    }
    return 0;
}