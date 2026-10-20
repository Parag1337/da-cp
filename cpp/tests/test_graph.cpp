#include "graph.h"
#include <cassert>
#include <iostream>

int main(){
    // BFS path
    {
        Graph g;
        g.nodes={"a","b","c"};
        g.edges={{ "e1","a","b",1,0,"",1},{ "e2","b","c",1,0,"",1}};
        g.build();
        auto r=bfsPath(g,"a","c",10);
        assert(r["found"]==true);
        assert(r["hops"]==2);
        std::cout<<"BFS ok\n";
    }
    // Dijkstra
    {
        Graph g;
        g.nodes={"a","b","c"};
        g.edges={{ "e1","a","b",5,0,"",5},{ "e2","a","c",10,0,"",10},{ "e3","b","c",1,0,"",1}};
        g.build();
        auto r=dijkstraPath(g,"a","c",10,"cost");
        assert(r["found"]==true);
        assert(r["cost"]==6);
        std::cout<<"Dijkstra ok\n";
    }
    // cycle
    {
        Graph g;
        g.nodes={"a","b","c"};
        g.edges={{ "e1","a","b",1,0,"",1},{ "e2","b","c",1,0,"",1},{ "e3","c","a",1,0,"",1}};
        g.build();
        auto r=detectCycles(g,10,10);
        assert(r["count"]>=1);
        std::cout<<"Cycle ok\n";
    }
    // SCC
    {
        Graph g;
        g.nodes={"a","b","c"};
        g.edges={{ "e1","a","b",1,0,"",1},{ "e2","b","a",1,0,"",1},{ "e3","b","c",1,0,"",1}};
        g.build();
        auto r=stronglyConnectedComponents(g);
        assert(r["count"]==2);
        std::cout<<"SCC ok\n";
    }
    // degrees
    {
        Graph g;
        g.nodes={"a","b"};
        g.edges={{ "e1","a","b",1,0,"",1},{ "e2","a","b",1,0,"",1}};
        g.build();
        auto r=degrees(g);
        std::cout<<"Degrees ok\n";
    }
    // disconnected
    {
        Graph g;
        g.nodes={"a","b"};
        g.edges={};
        g.build();
        auto r=bfsPath(g,"a","b",10);
        assert(r["found"]==false);
        std::cout<<"Disconnected ok\n";
    }
    // self loop
    {
        Graph g;
        g.nodes={"a"};
        g.edges={{ "e1","a","a",1,0,"",1}};
        g.build();
        auto r=detectCycles(g,10,10);
        std::cout<<"Selfloop ok cycles="<<r["count"]<<"\n";
    }
    std::cout<<"ALL TESTS PASSED\n";
    return 0;
}