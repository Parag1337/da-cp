#include "graph.h"
#include <iostream>

json bfsPath(const Graph &g, const std::string &src, const std::string &dst, int maxHops) {
    json res;
    res["algorithm"] = "BFS";
    res["metric"] = "minimum hops";
    if (!g.hasNode(src) || !g.hasNode(dst)) {
        res["found"] = false; res["error"] = "source or destination not found"; return res;
    }
    if (src == dst) { res["found"]=true; res["path"]=json::array({src}); res["hops"]=0; return res; }
    std::unordered_map<std::string,int> dist;
    std::unordered_map<std::string,std::string> prev;
    std::unordered_map<std::string,size_t> prevedge;
    std::queue<std::string> q;
    dist[src]=0; q.push(src);
    bool found=false;
    while(!q.empty()){
        auto u=q.front(); q.pop();
        if (dist[u] >= maxHops) continue;
        for (size_t ei : g.out.count(u)?g.out.at(u):std::vector<size_t>{}){
            const Edge &e=g.edges[ei];
            if (dist.count(e.to)) continue;
            dist[e.to]=dist[u]+1;
            prev[e.to]=u;
            prevedge[e.to]=ei;
            if (e.to==dst){ found=true; break; }
            q.push(e.to);
        }
        if (found) break;
    }
    if (!dist.count(dst)) { res["found"]=false; res["error"]="no path within hop limit"; return res; }
    std::vector<std::string> path;
    std::vector<size_t> edgeIdx;
    std::string cur=dst;
    while (cur!=src){ path.push_back(cur); edgeIdx.push_back(prevedge[cur]); cur=prev[cur]; }
    path.push_back(src);
    std::reverse(path.begin(),path.end());
    std::reverse(edgeIdx.begin(),edgeIdx.end());
    res["found"]=true;
    res["path"]=path;
    res["hops"]=dist[dst];
    json edges=json::array();
    for (size_t ei : edgeIdx) {
        const Edge &e=g.edges[ei];
        json je; je["id"]=e.id; je["from"]=e.from; je["to"]=e.to; je["amount"]=e.amount; je["timestamp"]=e.timestamp; je["asset"]=e.asset;
        edges.push_back(je);
    }
    res["edges"]=edges;
    return res;
}

json dijkstraPath(const Graph &g, const std::string &src, const std::string &dst, int maxHops, const std::string &costMetric) {
    json res;
    res["algorithm"]="Dijkstra";
    res["metric"]=costMetric;
    if (!g.hasNode(src) || !g.hasNode(dst)) { res["found"]=false; res["error"]="source or destination not found"; return res; }
    // reject negative costs
    for (auto &e : g.edges) if (e.cost < 0) { res["found"]=false; res["error"]="negative edge cost not allowed"; return res; }
    const long long INF = std::numeric_limits<long long>::max()/4;
    std::unordered_map<std::string,long long> dist;
    std::unordered_map<std::string,std::string> prev;
    std::unordered_map<std::string,size_t> prevedge;
    std::unordered_map<std::string,int> hops;
    for (auto &n : g.nodes) dist[n]=INF;
    dist[src]=0; hops[src]=0;
    using P = std::pair<long long,std::string>;
    std::priority_queue<P,std::vector<P>,std::greater<P>> pq;
    pq.push({0,src});
    bool found=false;
    while(!pq.empty()){
        auto [d,u]=pq.top(); pq.pop();
        if (d>dist[u]) continue;
        if (u==dst){ found=true; break; }
        if (hops[u] >= maxHops) continue;
        for (size_t ei : (g.out.count(u)?g.out.at(u):std::vector<size_t>{})){
            const Edge &e=g.edges[ei];
            long long w = e.cost;
            if (costMetric=="amount") w = e.amount; // amount as cost (nonnegative)
            if (w<0){ res["found"]=false; res["error"]="negative cost"; return res; }
            if (dist[u]+w < dist[e.to]){
                dist[e.to]=dist[u]+w;
                prev[e.to]=u;
                prevedge[e.to]=ei;
                hops[e.to]=hops[u]+1;
                pq.push({dist[e.to],e.to});
            }
        }
    }
    if (!found && dist[dst]>=INF) { res["found"]=false; res["error"]="no path within constraints"; return res; }
    std::vector<std::string> path;
    std::vector<size_t> edgeIdx;
    std::string cur=dst;
    while (cur!=src){ path.push_back(cur); edgeIdx.push_back(prevedge[cur]); cur=prev[cur]; }
    path.push_back(src);
    std::reverse(path.begin(),path.end());
    std::reverse(edgeIdx.begin(),edgeIdx.end());
    res["found"]=true;
    res["path"]=path;
    res["cost"]=dist[dst];
    res["hops"]=hops[dst];
    json edges=json::array();
    for (size_t ei : edgeIdx){
        const Edge &e=g.edges[ei];
        json je; je["id"]=e.id; je["from"]=e.from; je["to"]=e.to; je["amount"]=e.amount; je["timestamp"]=e.timestamp; je["asset"]=e.asset; je["cost"]=e.cost;
        edges.push_back(je);
    }
    res["edges"]=edges;
    return res;
}

json dijkstraTrace(const Graph &g, const std::string &src, const std::string &dst, int maxHops, const std::string &costMetric, int maxSteps) {
    json res; res["algorithm"]="Dijkstra"; res["metric"]=costMetric;
    json steps=json::array();
    if (!g.hasNode(src)) { res["found"]=false; res["error"]="source not found"; res["steps"]=steps; return res; }
    const long long INF = std::numeric_limits<long long>::max()/4;
    std::unordered_map<std::string,long long> dist;
    std::unordered_map<std::string,std::string> prev;
    std::unordered_map<std::string,size_t> prevedge;
    std::unordered_map<std::string,int> hops;
    for (auto &n : g.nodes) dist[n]=INF;
    dist[src]=0; hops[src]=0;
    using P = std::pair<long long,std::string>;
    std::priority_queue<P,std::vector<P>,std::greater<P>> pq;
    pq.push({0,src});
    bool found=false;
    std::vector<std::string> settleOrder;
    auto wOf = [&](const Edge &e)->long long { return costMetric=="amount" ? e.amount : e.cost; };
    while(!pq.empty() && (int)steps.size()<maxSteps){
        auto top=pq.top(); pq.pop();
        long long d=top.first; std::string u=top.second;
        if (d>dist[u]) continue;
        settleOrder.push_back(u);
        json s; s["current"]=u; s["distance"]=d; s["settleOrder"]=settleOrder;
        json dm=json::object();
        for (auto &kv: dist) if (kv.second<INF) dm[kv.first]=kv.second;
        s["distances"]=dm;
        if (u==dst){ found=true; s["event"]="settled-target"; steps.push_back(s); break; }
        if (hops[u]>=maxHops){ s["event"]="hop-limit"; steps.push_back(s); continue; }
        s["event"]="settle";
        steps.push_back(s);
        if ((int)steps.size()>=maxSteps) break;
        auto it=g.out.find(u);
        if (it==g.out.end()) continue;
        for (size_t ei: it->second){
            if ((int)steps.size()>=maxSteps) break;
            const Edge &e=g.edges[ei];
            long long w=wOf(e);
            json r; r["current"]=u; r["exploring"]=e.to;
            json je; je["id"]=e.id; je["from"]=e.from; je["to"]=e.to; je["amount"]=e.amount; je["cost"]=w; je["timestamp"]=e.timestamp; r["edge"]=je;
            long long cand = dist[u]+w;
            r["candidateDist"]=cand;
            r["bestDist"]= (dist[e.to]>=INF? -1 : dist[e.to]);
            if (cand < dist[e.to]){
                dist[e.to]=cand; prev[e.to]=u; prevedge[e.to]=ei; hops[e.to]=hops[u]+1;
                pq.push({dist[e.to],e.to});
                r["event"]="relaxed-improved"; r["newDist"]=dist[e.to];
            } else { r["event"]="relaxed-no-change"; }
            r["settleOrder"]=settleOrder;
            steps.push_back(r);
        }
    }
    json path=json::array(); json pedges=json::array();
    long long total=-1;
    if (dist.count(dst) && dist[dst]<INF){
        found=true; total=dist[dst];
        std::vector<std::string> p; std::vector<size_t> pe; std::string cur=dst; int guard=0;
        while(cur!=src && guard++<10000){ p.push_back(cur); if(!prevedge.count(cur)) break; pe.push_back(prevedge[cur]); cur=prev[cur]; }
        p.push_back(src);
        std::reverse(p.begin(),p.end()); std::reverse(pe.begin(),pe.end());
        for (auto &x:p) path.push_back(x);
        for (size_t ei:pe){ const Edge &e=g.edges[ei]; json je; je["id"]=e.id; je["from"]=e.from; je["to"]=e.to; je["amount"]=e.amount; je["cost"]=wOf(e); je["timestamp"]=e.timestamp; pedges.push_back(je); }
    }
    res["steps"]=steps; res["found"]=found; res["path"]=path; res["edges"]=pedges;
    res["cost"]=total; res["stepCount"]=steps.size(); res["settleOrder"]=settleOrder;
    return res;
}

json bfsTrace(const Graph &g, const std::string &src, const std::string &dst, int maxHops, int maxSteps) {
    json res; res["algorithm"]="BFS"; res["metric"]="minimum hops";
    json steps=json::array();
    if (!g.hasNode(src)) { res["found"]=false; res["error"]="source not found"; res["steps"]=steps; return res; }
    std::unordered_map<std::string,int> dist;
    std::unordered_map<std::string,std::string> prev;
    std::unordered_map<std::string,size_t> prevedge;
    std::queue<std::string> q;
    dist[src]=0; q.push(src);
    std::vector<std::string> visitOrder; visitOrder.push_back(src);
    bool found = (src==dst);
    auto emit = [&](const std::string &cur, const std::string &exploring, bool hasE, size_t ei){
        if ((int)steps.size()>=maxSteps) return;
        json s; s["current"]=cur; s["exploring"]=exploring; s["hasEdge"]=hasE;
        if (hasE){ const Edge &e=g.edges[ei]; json je; je["id"]=e.id; je["from"]=e.from; je["to"]=e.to; je["amount"]=e.amount; je["timestamp"]=e.timestamp; s["edge"]=je; }
        s["visitOrder"]=visitOrder;
        steps.push_back(s);
    };
    emit(src,"",false,0);
    while(!q.empty() && (int)steps.size()<maxSteps){
        auto u=q.front(); q.pop();
        if (dist[u] >= maxHops) continue;
        auto it = g.out.find(u);
        if (it==g.out.end()) continue;
        for (size_t ei : it->second){
            const Edge &e=g.edges[ei];
            if ((int)steps.size()>=maxSteps) break;
            bool isNew = !dist.count(e.to);
            if (isNew){
                dist[e.to]=dist[u]+1; prev[e.to]=u; prevedge[e.to]=ei;
                visitOrder.push_back(e.to);
                if (e.to==dst) found=true;
                else q.push(e.to);
            }
            emit(u,e.to,true,ei);
            if (found && e.to==dst) break;
        }
        if (found) break;
    }
    json path=json::array(); json pedges=json::array();
    if (found && dist.count(dst)){
        std::vector<std::string> p; std::vector<size_t> pe;
        std::string cur=dst;
        while (cur!=src){ p.push_back(cur); pe.push_back(prevedge[cur]); cur=prev[cur]; }
        p.push_back(src);
        std::reverse(p.begin(),p.end()); std::reverse(pe.begin(),pe.end());
        for (auto &x:p) path.push_back(x);
        for (size_t ei:pe){ const Edge &e=g.edges[ei]; json je; je["id"]=e.id; je["from"]=e.from; je["to"]=e.to; je["amount"]=e.amount; je["timestamp"]=e.timestamp; je["asset"]=e.asset; pedges.push_back(je); }
    }
    res["steps"]=steps; res["visitOrder"]=visitOrder; res["found"]=found && (bool)dist.count(dst);
    res["path"]=path; res["edges"]=pedges;
    res["hops"]= dist.count(dst)? dist[dst] : -1;
    res["stepCount"]=steps.size();
    return res;
}

json dfsTrace(const Graph &g, const std::string &src, const std::string &dst, int maxHops, int maxSteps) {
    json res; res["algorithm"]="DFS";
    json steps=json::array();
    if (!g.hasNode(src)) { res["found"]=false; res["error"]="source not found"; res["steps"]=steps; return res; }
    std::unordered_set<std::string> visited;
    std::vector<std::string> stack; stack.push_back(src);
    std::vector<std::string> visitOrder;
    std::unordered_map<std::string,std::string> prev;
    std::unordered_map<std::string,size_t> prevedge;
    std::unordered_map<std::string,int> depth; depth[src]=0;
    bool found=false;
    auto emit=[&](const std::string &cur, const std::string &exploring, bool hasE, size_t ei){
        if ((int)steps.size()>=maxSteps) return;
        json s; s["current"]=cur; s["exploring"]=exploring; s["hasEdge"]=hasE;
        if (hasE){ const Edge &e=g.edges[ei]; json je; je["id"]=e.id; je["from"]=e.from; je["to"]=e.to; je["amount"]=e.amount; je["timestamp"]=e.timestamp; s["edge"]=je; }
        s["visitOrder"]=visitOrder; steps.push_back(s);
    };
    emit(src,"",false,0);
    while(!stack.empty() && (int)steps.size()<maxSteps){
        std::string u=stack.back(); stack.pop_back();
        if (visited.count(u)) continue;
        visited.insert(u); visitOrder.push_back(u);
        if (u==dst){ found=true; emit(u,"",false,0); break; }
        if (depth[u]>=maxHops) { emit(u,"",false,0); continue; }
        auto it=g.out.find(u);
        std::vector<size_t> eis = it==g.out.end()? std::vector<size_t>{} : it->second;
        for (int i=(int)eis.size()-1;i>=0;--i){
            size_t ei=eis[i]; const Edge &e=g.edges[ei];
            emit(u,e.to,true,ei);
            if (!visited.count(e.to)){ prev[e.to]=u; prevedge[e.to]=ei; depth[e.to]=depth[u]+1; stack.push_back(e.to); }
        }
    }
    json path=json::array(); json pedges=json::array();
    if (found){
        std::vector<std::string> p; std::vector<size_t> pe; std::string cur=dst; int guard=0;
        while(cur!=src && guard++<10000){ p.push_back(cur); if(!prevedge.count(cur)) break; pe.push_back(prevedge[cur]); cur=prev[cur]; }
        p.push_back(src);
        std::reverse(p.begin(),p.end()); std::reverse(pe.begin(),pe.end());
        for (auto &x:p) path.push_back(x);
        for (size_t ei:pe){ const Edge &e=g.edges[ei]; json je; je["id"]=e.id; je["from"]=e.from; je["to"]=e.to; je["amount"]=e.amount; je["timestamp"]=e.timestamp; pedges.push_back(je); }
    }
    res["steps"]=steps; res["visitOrder"]=visitOrder; res["found"]=found; res["path"]=path; res["edges"]=pedges; res["stepCount"]=steps.size();
    return res;
}

json detectCycles(const Graph &g, int maxCycles, int maxLen) {
    json res; res["algorithm"]="Directed cycle detection (DFS)";
    std::vector<std::vector<std::string>> cycles;
    std::unordered_set<std::string> visited, rec;
    std::vector<std::string> stack;
    // simple DFS find cycles up to maxLen
    std::function<void(const std::string&,int)> dfs = [&](const std::string &u, int depth){
        if ((int)cycles.size() >= maxCycles) return;
        visited.insert(u); rec.insert(u); stack.push_back(u);
        for (size_t ei : (g.out.count(u)?g.out.at(u):std::vector<size_t>{})){
            const Edge &e=g.edges[ei];
            if (rec.count(e.to)){
                // found cycle: from e.to to u
                auto it=std::find(stack.begin(),stack.end(),e.to);
                if (it!=stack.end()){
                    std::vector<std::string> cyc(it,stack.end());
                    if ((int)cyc.size()<=maxLen) cycles.push_back(cyc);
                }
            } else if (!visited.count(e.to) && depth+1<=maxLen){
                dfs(e.to,depth+1);
            }
            if ((int)cycles.size()>=maxCycles) return;
        }
        stack.pop_back(); rec.erase(u);
    };
    for (auto &n : g.nodes){
        if (!visited.count(n)) dfs(n,1);
        if ((int)cycles.size()>=maxCycles) break;
    }
    // dedup identical
    std::vector<std::vector<std::string>> uniq;
    std::set<std::vector<std::string>> seen;
    for (auto &c : cycles){ if (seen.count(c)) continue; seen.insert(c); uniq.push_back(c); }
    json arr=json::array();
    for (auto &c : uniq){ json j=json::array(); for (auto &x:c) j.push_back(x); arr.push_back(j); }
    res["cycles"]=arr;
    res["count"]=uniq.size();
    return res;
}

json stronglyConnectedComponents(const Graph &g) {
    json res; res["algorithm"]="Tarjan SCC";
    // Tarjan
    int index=0;
    std::unordered_map<std::string,int> indices, low;
    std::unordered_set<std::string> onstack;
    std::stack<std::string> st;
    std::vector<std::vector<std::string>> comps;
    std::function<void(const std::string&)> strongconnect = [&](const std::string &v){
        indices[v]=index; low[v]=index; index++;
        st.push(v); onstack.insert(v);
        for (size_t ei : (g.out.count(v)?g.out.at(v):std::vector<size_t>{})){
            const Edge &e=g.edges[ei];
            const std::string &w=e.to;
            if (!indices.count(w)){ strongconnect(w); low[v]=std::min(low[v],low[w]); }
            else if (onstack.count(w)) low[v]=std::min(low[v],indices[w]);
        }
        if (low[v]==indices[v]){
            std::vector<std::string> comp;
            while(true){
                std::string w=st.top(); st.pop(); onstack.erase(w); comp.push_back(w);
                if (w==v) break;
            }
            comps.push_back(comp);
        }
    };
    for (auto &n : g.nodes) if (!indices.count(n)) strongconnect(n);
    json arr=json::array();
    for (auto &c : comps){ json j=json::array(); for (auto &x:c) j.push_back(x); arr.push_back(j); }
    res["components"]=arr;
    res["count"]=comps.size();
    return res;
}

json degrees(const Graph &g) {
    json res; res["algorithm"]="degree analysis";
    json arr=json::array();
    std::set<std::string> uniq;
    for (auto &n : g.nodes) uniq.insert(n);
    for (auto &n : uniq){
        std::set<std::string> inU, outU;
        int inD=0,outD=0;
        if (g.in.count(n)) for (size_t ei: g.in.at(n)){ inD++; inU.insert(g.edges[ei].from); }
        if (g.out.count(n)) for (size_t ei: g.out.at(n)){ outD++; outU.insert(g.edges[ei].to); }
        json j; j["node"]=n; j["inDegree"]=inD; j["outDegree"]=outD; j["uniqueIn"]=inU.size(); j["uniqueOut"]=outU.size(); j["total"]=inD+outD;
        arr.push_back(j);
    }
    res["nodes"]=arr;
    return res;
}

json topKActive(const Graph &g, int k) {
    json d=degrees(g);
    std::vector<json> v;
    for (auto &j : d["nodes"]) v.push_back(j);
    std::sort(v.begin(),v.end(),[](const json&a,const json&b){ return (int)a["total"] > (int)b["total"]; });
    json res; res["algorithm"]="top-k active";
    json arr=json::array();
    for (int i=0;i<k && i<(int)v.size();++i) arr.push_back(v[i]);
    res["top"]=arr;
    return res;
}

json neighbors(const Graph &g, const std::string &node, const std::string &direction, int hops, int limit) {
    json res; res["algorithm"]="neighborhood";
    if (!g.hasNode(node)){ res["found"]=false; res["error"]="node not found"; return res; }
    std::unordered_set<std::string> visited; visited.insert(node);
    std::queue<std::pair<std::string,int>> q; q.push({node,0});
    std::vector<std::string> nodes; nodes.push_back(node);
    int cnt=0;
    while(!q.empty() && (int)nodes.size() < limit){
        auto [u,d]=q.front(); q.pop();
        if (d>=hops) continue;
        std::vector<size_t> eis;
        if (direction=="out"||direction=="both") if (g.out.count(u)) for (size_t ei: g.out.at(u)) eis.push_back(ei);
        if (direction=="in"||direction=="both") if (g.in.count(u)) for (size_t ei: g.in.at(u)) eis.push_back(ei);
        for (size_t ei: eis){
            const Edge &e=g.edges[ei];
            std::string nb = (e.from==u)? e.to : e.from;
            if (!visited.count(nb)){ visited.insert(nb); nodes.push_back(nb); q.push({nb,d+1}); }
            if ((int)nodes.size()>=limit) break;
        }
    }
    res["found"]=true;
    res["nodes"]=nodes;
    // edges among visited
    json edges=json::array();
    for (auto &e : g.edges){
        if (visited.count(e.from) && visited.count(e.to)) {
            json je; je["id"]=e.id; je["from"]=e.from; je["to"]=e.to; je["amount"]=e.amount; je["timestamp"]=e.timestamp; je["asset"]=e.asset;
            edges.push_back(je);
        }
    }
    res["edges"]=edges;
    return res;
}

json connectedComponents(const Graph &g) {
    // undirected components
    json res; res["algorithm"]="connected components (undirected)";
    std::unordered_set<std::string> visited;
    std::vector<std::vector<std::string>> comps;
    for (auto &s : g.nodes){
        if (visited.count(s)) continue;
        std::vector<std::string> comp;
        std::stack<std::string> st; st.push(s); visited.insert(s);
        while(!st.empty()){
            auto u=st.top(); st.pop(); comp.push_back(u);
            // neighbors both directions
            std::set<std::string> nb;
            if (g.out.count(u)) for (size_t ei: g.out.at(u)) nb.insert(g.edges[ei].to);
            if (g.in.count(u)) for (size_t ei: g.in.at(u)) nb.insert(g.edges[ei].from);
            for (auto &w: nb) if (!visited.count(w)){ visited.insert(w); st.push(w); }
        }
        comps.push_back(comp);
    }
    json arr=json::array();
    for (auto &c: comps){ json j=json::array(); for(auto&x:c) j.push_back(x); arr.push_back(j);}
    res["components"]=arr; res["count"]=comps.size();
    return res;
}