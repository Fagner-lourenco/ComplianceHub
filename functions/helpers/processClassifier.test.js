const { classifyProcessArea } = require('./processClassifier');

describe('processClassifier', () => {
    it.each([
        [{ tags: { criminal: true } }, 'CRIMINAL'],
        [{ classifications: ['Apelação Criminal'], area: 'NÃO INFORMADO' }, 'CRIMINAL'],
        [{ classifications: ['Carta Precatória Criminal'], area: 'NÃO INFORMADO' }, 'CRIMINAL'],
        [{ subjects: ['Roubo'], area: 'NÃO INFORMADO' }, 'CRIMINAL'],
        [{ courtType: 'ESPECIAL CRIMINAL' }, 'CRIMINAL'],
        [{ cnjBroadSubject: 'DIREITO PROCESSUAL PENAL' }, 'CRIMINAL'],
        [{ cnjProcedure: 'INQUÉRITO POLICIAL' }, 'CRIMINAL'],
    ])('classifies criminal process by strong signals %#', (input, expected) => {
        expect(classifyProcessArea(input).area).toBe(expected);
    });

    it('does not classify weak generic subject as criminal alone', () => {
        expect(classifyProcessArea({ subject: 'INTIMAÇÃO' }).area).toBe('UNKNOWN');
    });

    it.each([
        [{ courtType: 'TRABALHISTA' }, 'LABOR'],
        [{ classifications: ['Recurso Ordinário Trabalhista'] }, 'LABOR'],
        [{ cnjBroadSubject: 'DIREITO DO TRABALHO' }, 'LABOR'],
        [{ subject: 'HORAS EXTRAS', classifications: ['Ação Trabalhista - Rito Sumaríssimo'] }, 'LABOR'],
        [{ tribunal: 'TRT10' }, 'LABOR'],
    ])('classifies labor process by strong signals %#', (input, expected) => {
        expect(classifyProcessArea(input).area).toBe(expected);
    });

    it('does not classify procedural civil and labor area as labor alone', () => {
        expect(classifyProcessArea({ area: 'DIREITO PROCESSUAL CIVIL E DO TRABALHO' }).area).toBe('UNKNOWN');
    });
});
