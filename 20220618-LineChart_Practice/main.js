const parseNA = string => (string === 'NA' ? undefined : string);
const parseDate = string => d3.timeParse('%Y-%m-%d')(string);

function type(d) {
    const date = parseDate(d.release_date);
    return {
        budget: +d.budget,
        genre: parseNA(d.genre),
        genres: JSON.parse(d.genres).map(d => d.name),
        homepage: parseNA(d.homepage),
        id: +d.id,
        imdb_id: parseNA(d.imdb_id),
        original_language: parseNA(d.original_language),
        overview: parseNA(d.overview),
        popularity: +d.popularity,
        poster_path: parseNA(d.poster_path),
        production_countries: JSON.parse(d.production_countries),
        release_date: date,
        release_year: date.getFullYear(),
        revenue: +d.revenue,
        runtime: +d.runtime,
        tagline: parseNA(d.tagline),
        title: parseNA(d.title),
        vote_average: +d.vote_average,
        vote_count: +d.vote_count
    }
}

function filterData(data) {
    return data.filter(
        d => {
            return (
                d.release_year > 1999 && d.release_year < 2010 &&
                d.revenue > 0 &&
                d.budget > 0 &&
                d.genre &&
                d.title
            );
        }
    );
}

function formatTicks(d) {
    return d3.format('~s')(d)
        .replace('M', 'mil')
        .replace('G', 'bil')
        .replace('T', 'tri')
}

function prepareBarChartData(data) {
    console.log(data);
    const dataMap = d3.rollup(
        data,
        v => d3.sum(v, leaf => leaf.revenue),
        d => d.genre
    );
    // debugger;
    const dataArray = Array.from(dataMap, d => ({ genre: d[0], revenue: d[1] }));
    //[...dataMap][0][0]
    //[...dataMap][0][0]
    return dataArray;
}

function prepareScatterData(data) {
    return data.sort((a, b) => b.budget - a.budget)
        .filter((d, i) => i < 100);
}

function addLabel(axis, label, x, y) {
    axis.selectAll('.tick:last-of-type text')
        .clone()
        .text(label)
        .attr('x', x).attr('y', y)
        .style('text-anchor', 'start')
        .style('font-weight', 'bold')
        .style('fill', '#555')
}

function prepareLineChartData(data) {
    //取得發行年份
    const groupByYear = d => d.release_year;
    //只取出revenue加總
    const sumOfRevenue = values => d3.sum(values, d => d.revenue);
    //依年份加總revenue
    const sumOfRevenueByYear = d3.rollup(data, sumOfRevenue, groupByYear);
    //只取出budget加總
    const sumOfBudget = values => d3.sum(values, d => d.budget);
    //依年份加總budget
    const sumOfBudgetByYear = d3.rollup(data, sumOfBudget, groupByYear);
    // debugger;
    //放進array並排序
    const revenueArray = Array.from(sumOfRevenueByYear).sort((a, b) => a[0] - b[0]);
    const budgetArray = Array.from(sumOfBudgetByYear).sort((a, b) => a[0] - b[0]);
    // debugger;
    //用年份來產生日期時間格式的資料，作為後續繪圖的X軸
    const parseYear = d3.timeParse('%Y');
    const dates = revenueArray.map(d => parseYear(d[0]));
    //找出最大值(把各年份的revenue與各年份的budget都先放在一起)
    const revenueAndBudgetArray = revenueArray.map(d => d[1]).concat(budgetArray.map(d => d[1]));
    const yMax = d3.max(revenueAndBudgetArray);
    // debugger;

    //最終資料回傳
    const lineData = {
        series: [
            {
                name: 'Revenue',
                color: 'dodgerblue',
                values: revenueArray.map(d => ({ date: parseYear(d[0]), value: d[1] }))
            },
            {
                name: 'Budget',
                color: 'darkorange',
                values: budgetArray.map(d => ({ date: parseYear(d[0]), value: d[1] }))
            }
        ],
        dates: dates,
        yMax: yMax
    }
    // debugger;
    return lineData;
}

function setupCanvas(lineChartData) {
    const svg_width = 500;
    const svg_height = 500;
    const chart_margin = { top: 80, right: 60, bottom: 40, left: 80 };
    const chart_width = svg_width - (chart_margin.left + chart_margin.right);
    const chart_height = svg_height - (chart_margin.top + chart_margin.bottom);
    const this_svg = d3.select('.line-chart-container').append('svg')
        .attr('width', svg_width).attr('height', svg_height)
        .append('g')
        .attr('transform', `translate(${chart_margin.left},${chart_margin.top})`);
    //scale
    //用時間來做X軸
    const xExtent = d3.extent(lineChartData.dates);
    //xExtent抓出最小時間(2000)與最大時間(2009)
    const xScale = d3.scaleTime().domain(xExtent).range([0, chart_width]);
    //垂直空間的分配 - 平均分布給各種類
    const yScale = d3.scaleLinear().domain([0, lineChartData.yMax]).range([chart_height, 0]);
    //最小的放最下方，與座標相反

    //line generator
    const lineGen = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value));
    //Draw Line
    const chartGroup = this_svg.append('g').attr('class', 'line-chart');
    
    chartGroup.selectAll('.line-series').data(lineChartData.series).enter()
        .append('path')
        .attr('class', d => `line-series ${d.name.toLowerCase()}`)
        .attr('d', d => lineGen(d.values))
        .style('fill', 'none').style('stroke', d => d.color);

    //Draw X axis
    const xAxis = d3.axisBottom(xScale).tickSizeOuter(0);
    this_svg.append('g').attr('class', 'x axis')
        .attr('transform', `translate(0,${chart_height})`)
        .call(xAxis);
    //Draw Y axis
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(formatTicks)
        .tickSizeInner(-chart_width).tickSizeOuter(0);
    this_svg.append('g').attr('class', 'y axis').call(yAxis);

    //Draw Series Label
    //放在最後一個點的旁邊(x+5,y不變)
    chartGroup.append('g').attr('class', 'series-labels')
        .selectAll('.series-label').data(lineChartData.series).enter()
        .append('text')
        .attr('x', d => xScale(d.values[d.values.length - 1].date) + 5)
        .attr('y', d => yScale(d.values[d.values.length - 1].value))
        .text(d => d.name)
        .style('dominant-baseline', 'central')
        .style('font-size', '0.7em').style('font-weight', 'bold')
        .style('fill', d => d.color);

    //Draw Header - Line
    const header_Line = this_svg.append('g')
        .attr('class', 'bar-header')
        .attr('transform', `translate(0,${-chart_margin.top / 2})`)
        .append('text');
    header_Line.append('tspan').text('Budget and Revenue over time in $US');
    header_Line.append('tspan').text('Films w/ budget and revenue figures, 2000-2009')
        .attr('x', 0)
        .attr('y', 20)
        .style('font-size', '0.8em')
        .style('fill', '#555');
}

//Main
function ready(movies) {
    const moviesClean = filterData(movies);
    const lineChartData = prepareLineChartData(moviesClean);
    // debugger;
    console.log(lineChartData);
    setupCanvas(lineChartData);
}

d3.csv('data/movies.csv', type).then(
    res => {
        ready(res);
    }
);